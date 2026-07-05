// Lightning Mines — daily short renderer (v2: motion + chart + 60fps).
// Apple frameworks only (AppKit + CoreGraphics + AVFoundation). No ffmpeg.
//
// Usage: render <spec.json> <audio.aiff> <out.mp4>
// spec.json: { title, lines:[{label,value,tone}], verdict, cta, chart?:{label,points:[Double]} }

import AppKit
import AVFoundation
import CoreMedia

let args = CommandLine.arguments
guard args.count == 4 else {
    FileHandle.standardError.write("usage: render <spec.json> <audio.aiff> <out.mp4>\n".data(using: .utf8)!)
    exit(2)
}
let specURL = URL(fileURLWithPath: args[1])
let audioURL = URL(fileURLWithPath: args[2])
let outURL = URL(fileURLWithPath: args[3])

struct Line: Decodable { let label: String; let value: String; let tone: String }
struct Chart: Decodable { let label: String; let points: [Double] }
struct Spec: Decodable {
    let title: String; let lines: [Line]; let verdict: String; let cta: String
    let chart: Chart?
}
let spec: Spec
do { spec = try JSONDecoder().decode(Spec.self, from: Data(contentsOf: specURL)) }
catch { FileHandle.standardError.write("bad spec: \(error)\n".data(using: .utf8)!); exit(3) }

// ── palette ──
func hex(_ h: UInt32) -> NSColor {
    NSColor(srgbRed: CGFloat((h >> 16) & 0xff)/255, green: CGFloat((h >> 8) & 0xff)/255,
            blue: CGFloat(h & 0xff)/255, alpha: 1)
}
let BG = hex(0x080808), AMBER = hex(0xf59e0b), TEAL = hex(0x00d4aa), RED = hex(0xef4444)
let WHITE = hex(0xffffff), GRAY = hex(0x9ca3af), PANEL = hex(0x14140f), BLACK = hex(0x000000)
func toneColor(_ t: String) -> NSColor { t == "pos" ? TEAL : (t == "neg" ? RED : WHITE) }

// ── geometry / timing ──
let W = 1080, H = 1920
let fps: Int32 = 60
let hasAudio = args[2] != "-" && FileManager.default.fileExists(atPath: args[2])
let audioAsset: AVURLAsset? = hasAudio ? AVURLAsset(url: audioURL) : nil
let audioDur = audioAsset != nil ? CMTimeGetSeconds(audioAsset!.duration) : 0
// Silent build (no voiceover) holds the finished graphic ~14s for muted autoplay.
let total = max(14.0, audioDur > 0 ? audioDur + 1.4 : 14.0)
let frameCount = Int(total * Double(fps))
let margin: CGFloat = 76
let contentW = CGFloat(W) - margin*2

// ── writer ──
let tmpVideo = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent("lm_vid_\(UUID().uuidString).mp4")
try? FileManager.default.removeItem(at: tmpVideo)
let writer = try! AVAssetWriter(outputURL: tmpVideo, fileType: .mp4)
let vInput = AVAssetWriterInput(mediaType: .video, outputSettings: [
    AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 12_000_000,
        AVVideoMaxKeyFrameIntervalKey: 60,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    ],
])
vInput.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: vInput,
    sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H])
writer.add(vInput); writer.startWriting(); writer.startSession(atSourceTime: .zero)

// ── fonts / easing ──
let heavy = { (s: CGFloat) in NSFont.systemFont(ofSize: s, weight: .heavy) }
let bold  = { (s: CGFloat) in NSFont.systemFont(ofSize: s, weight: .bold) }
let mono  = { (s: CGFloat) in NSFont.monospacedDigitSystemFont(ofSize: s, weight: .heavy) }
let med   = { (s: CGFloat) in NSFont.systemFont(ofSize: s, weight: .semibold) }
func clamp(_ v: CGFloat) -> CGFloat { v < 0 ? 0 : (v > 1 ? 1 : v) }
func ease(_ t: CGFloat) -> CGFloat { let x = clamp(t); return x*x*(3 - 2*x) }
// spring-ish overshoot for pop-in
func pop(_ t: CGFloat) -> CGFloat {
    let x = clamp(t); if x >= 1 { return 1 }
    return 1 - pow(2, -8*x) * cos(x*10)
}
func phase(_ t: Double, _ start: Double, _ dur: Double) -> CGFloat { ease(CGFloat((t - start)/dur)) }

func draw(_ s: String, font: NSFont, color: NSColor, x: CGFloat, y: CGFloat,
          align: NSTextAlignment = .left, maxW: CGFloat, alpha: CGFloat = 1) {
    if alpha <= 0.001 { return }
    let para = NSMutableParagraphStyle(); para.alignment = align; para.lineBreakMode = .byWordWrapping
    NSAttributedString(string: s, attributes: [.font: font,
        .foregroundColor: color.withAlphaComponent(alpha), .paragraphStyle: para])
        .draw(with: NSRect(x: x, y: y, width: maxW, height: 400),
              options: [.usesLineFragmentOrigin], context: nil)
}
func measureH(_ s: String, font: NSFont, maxW: CGFloat) -> CGFloat {
    let para = NSMutableParagraphStyle(); para.lineBreakMode = .byWordWrapping
    return NSAttributedString(string: s, attributes: [.font: font, .paragraphStyle: para])
        .boundingRect(with: NSSize(width: maxW, height: 800), options: [.usesLineFragmentOrigin]).height
}

// parse a display value ("$62,725", "133.9T", "-$0.61", "~$68,253", "$0.0295/TH")
// into (prefix, number, decimals, grouped, suffix) so we can count it up.
func parseValue(_ s: String) -> (pre: String, num: Double, dec: Int, grouped: Bool, post: String)? {
    guard let r = s.range(of: "[0-9][0-9,]*\\.?[0-9]*", options: .regularExpression) else { return nil }
    let numStr = String(s[r])
    let pre = String(s[s.startIndex..<r.lowerBound])
    let post = String(s[r.upperBound...])
    let clean = numStr.replacingOccurrences(of: ",", with: "")
    guard let num = Double(clean) else { return nil }
    let dec = clean.contains(".") ? (clean.count - clean.distance(from: clean.startIndex,
              to: clean.firstIndex(of: ".")!) - 1) : 0
    return (pre, num, dec, numStr.contains(","), post)
}
func group(_ intStr: String) -> String {
    var out = ""; var c = 0
    for ch in intStr.reversed() { if c > 0 && c % 3 == 0 { out.append(",") }; out.append(ch); c += 1 }
    return String(out.reversed())
}
func fmt(_ v: Double, dec: Int, grouped: Bool) -> String {
    if dec > 0 { return String(format: "%.\(dec)f", v) }
    let i = String(Int(v.rounded())); return grouped ? group(i) : i
}

// ── render loop ──
for f in 0..<frameCount {
    let t = Double(f) / Double(fps)
    var pbOut: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pbOut)
    guard let pb = pbOut else { continue }
    CVPixelBufferLockBaseAddress(pb, [])
    let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb), width: W, height: H,
        bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(pb),
        space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
    ctx.translateBy(x: 0, y: CGFloat(H)); ctx.scaleBy(x: 1, y: -1)
    let ns = NSGraphicsContext(cgContext: ctx, flipped: true)
    NSGraphicsContext.saveGraphicsState(); NSGraphicsContext.current = ns

    // ---- background: base + amber glow + vignette ----
    BG.setFill(); NSRect(x: 0, y: 0, width: W, height: H).fill()
    ctx.saveGState()
    let glow = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
        colors: [AMBER.withAlphaComponent(0.16).cgColor, AMBER.withAlphaComponent(0).cgColor] as CFArray,
        locations: [0, 1])!
    ctx.drawRadialGradient(glow, startCenter: CGPoint(x: CGFloat(W)*0.5, y: 300), startRadius: 0,
        endCenter: CGPoint(x: CGFloat(W)*0.5, y: 300), endRadius: 720, options: [])
    let vig = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
        colors: [BLACK.withAlphaComponent(0).cgColor, BLACK.withAlphaComponent(0.55).cgColor] as CFArray,
        locations: [0.55, 1])!
    ctx.drawRadialGradient(vig, startCenter: CGPoint(x: CGFloat(W)/2, y: CGFloat(H)/2), startRadius: 300,
        endCenter: CGPoint(x: CGFloat(W)/2, y: CGFloat(H)/2), endRadius: 1200, options: [])
    ctx.restoreGState()
    AMBER.setFill(); NSRect(x: 0, y: 0, width: W, height: 7).fill()

    var y: CGFloat = 120
    // wordmark
    let bx = margin
    let bolt = NSBezierPath()
    bolt.move(to: NSPoint(x: bx+22, y: y+2));  bolt.line(to: NSPoint(x: bx+2, y: y+30))
    bolt.line(to: NSPoint(x: bx+18, y: y+30)); bolt.line(to: NSPoint(x: bx+14, y: y+52))
    bolt.line(to: NSPoint(x: bx+34, y: y+22)); bolt.line(to: NSPoint(x: bx+18, y: y+22)); bolt.close()
    AMBER.setFill(); bolt.fill()
    draw("LIGHTNING MINES", font: med(30), color: GRAY, x: bx+50, y: y+9, maxW: 500)
    y += 100

    // title
    let ta = phase(t, 0.12, 0.4)
    draw(spec.title, font: heavy(72), color: AMBER, x: margin, y: y + (1-ta)*14, maxW: contentW, alpha: ta)
    y += measureH(spec.title, font: heavy(72), maxW: contentW) + 44

    // ---- chart panel ----
    if let chart = spec.chart, chart.points.count >= 2 {
        let ph: CGFloat = 430
        let ca = phase(t, 0.5, 0.4)
        PANEL.withAlphaComponent(0.9*ca).setFill()
        NSBezierPath(roundedRect: NSRect(x: margin, y: y, width: contentW, height: ph),
                     xRadius: 22, yRadius: 22).fill()
        draw(chart.label, font: med(28), color: GRAY, x: margin+34, y: y+26, maxW: contentW-68, alpha: ca)

        let pts = chart.points
        let first = pts.first!, last = pts.last!
        let chg = first != 0 ? (last - first)/first*100 : 0
        let chgColor = chg >= 0 ? TEAL : RED
        draw(String(format: "%@%.1f%%", chg >= 0 ? "+" : "", chg), font: heavy(34), color: chgColor,
             x: margin+34, y: y+22, align: .right, maxW: contentW-68, alpha: ca)

        // plot area
        let px = margin+40, pw = contentW-80
        let pyTop = y+110, pyBot = y+ph-56, phgt = pyBot-pyTop
        let lo = pts.min()!, hi = pts.max()!
        let span = max(hi - lo, 1)
        func X(_ i: Int) -> CGFloat { px + pw*CGFloat(i)/CGFloat(pts.count-1) }
        func Y(_ v: Double) -> CGFloat { pyBot - CGFloat((v-lo)/span)*phgt }
        // faint gridlines
        if ca > 0.5 {
            GRAY.withAlphaComponent(0.12).setStroke()
            for g in 0...2 {
                let gy = pyTop + phgt*CGFloat(g)/2
                let gl = NSBezierPath(); gl.lineWidth = 1
                gl.move(to: NSPoint(x: px, y: gy)); gl.line(to: NSPoint(x: px+pw, y: gy)); gl.stroke()
            }
        }
        // progressive reveal
        let rf = phase(t, 0.85, 1.6)
        if rf > 0.002 {
            let tipX = px + pw*rf
            var line = NSBezierPath(); line.lineWidth = 5
            line.lineJoinStyle = .round; line.lineCapStyle = .round
            var poly: [NSPoint] = []
            for i in 0..<pts.count {
                let xi = X(i)
                if xi <= tipX { poly.append(NSPoint(x: xi, y: Y(pts[i]))) }
                else {
                    let i0 = i-1
                    let seg = (tipX - X(i0)) / (X(i) - X(i0))
                    let yv = Y(pts[i0]) + (Y(pts[i]) - Y(pts[i0]))*seg
                    poly.append(NSPoint(x: tipX, y: yv)); break
                }
            }
            if poly.count >= 2 {
                // area fill
                let area = NSBezierPath()
                area.move(to: NSPoint(x: poly[0].x, y: pyBot))
                for p in poly { area.line(to: p) }
                area.line(to: NSPoint(x: poly.last!.x, y: pyBot)); area.close()
                AMBER.withAlphaComponent(0.14).setFill(); area.fill()
                // line
                line.move(to: poly[0]); for p in poly.dropFirst() { line.line(to: p) }
                AMBER.setStroke(); line.stroke()
                // leading dot
                let tip = poly.last!
                WHITE.setFill(); NSBezierPath(ovalIn: NSRect(x: tip.x-9, y: tip.y-9, width: 18, height: 18)).fill()
                AMBER.setFill(); NSBezierPath(ovalIn: NSRect(x: tip.x-6, y: tip.y-6, width: 12, height: 12)).fill()
            }
        }
        y += ph + 40
    }

    // ---- stat grid 2x2 (first 4 lines) ----
    let cells = Array(spec.lines.prefix(4))
    let gap: CGFloat = 24
    let cw = (contentW - gap)/2, ch: CGFloat = 190
    for (i, line) in cells.enumerated() {
        let col = CGFloat(i % 2), row = CGFloat(i / 2)
        let cx = margin + col*(cw+gap), cy = y + row*(ch+gap)
        let ap = pop(CGFloat((t - (2.3 + Double(i)*0.18)) / 0.6))
        if ap <= 0.01 { continue }
        let a = min(ap, 1)
        PANEL.withAlphaComponent(0.92*min(a,1)).setFill()
        NSBezierPath(roundedRect: NSRect(x: cx, y: cy + (1-a)*16, width: cw, height: ch),
                     xRadius: 18, yRadius: 18).fill()
        draw(line.label, font: med(26), color: GRAY, x: cx+26, y: cy+28, maxW: cw-52, alpha: a)
        // count-up value
        var shown = line.value
        if let p = parseValue(line.value) {
            let cu = ease(CGFloat((t - (2.4 + Double(i)*0.18)) / 0.7))
            shown = p.pre + fmt(p.num*Double(cu), dec: p.dec, grouped: p.grouped) + p.post
        }
        draw(shown, font: mono(58), color: toneColor(line.tone), x: cx+26, y: cy+96, maxW: cw-52, alpha: a)
    }
    y += ch*2 + gap + 46

    // verdict
    let va = phase(t, 3.7, 0.5)
    draw(spec.verdict, font: bold(44), color: WHITE, x: margin, y: y, maxW: contentW, alpha: va)

    // CTA pill (pulse)
    let ctaA = phase(t, 4.1, 0.5)
    if ctaA > 0.002 {
        let pulse = 1 + 0.02*sin(CGFloat(t)*3.4)
        let baseW = contentW, pw2 = baseW*pulse, pillH: CGFloat = 100
        let pillX = margin - (pw2-baseW)/2, pillY = CGFloat(H) - 226
        AMBER.withAlphaComponent(ctaA).setFill()
        NSBezierPath(roundedRect: NSRect(x: pillX, y: pillY, width: pw2, height: pillH),
                     xRadius: 22, yRadius: 22).fill()
        draw("Run your numbers  →  \(spec.cta)", font: heavy(40), color: BLACK,
             x: margin, y: pillY+28, align: .center, maxW: contentW, alpha: ctaA)
    }
    draw("AI-generated narration · not financial advice", font: med(22), color: GRAY,
         x: margin, y: CGFloat(H)-86, align: .center, maxW: contentW, alpha: 0.75)

    NSGraphicsContext.restoreGraphicsState(); CVPixelBufferUnlockBaseAddress(pb, [])
    while !vInput.isReadyForMoreMediaData { usleep(1500) }
    adaptor.append(pb, withPresentationTime: CMTime(value: CMTimeValue(f), timescale: fps))
}

vInput.markAsFinished()
let sem = DispatchSemaphore(value: 0)
writer.finishWriting { sem.signal() }; sem.wait()
if writer.status != .completed {
    FileHandle.standardError.write("video failed: \(String(describing: writer.error))\n".data(using: .utf8)!); exit(4)
}

// mux voiceover
let comp = AVMutableComposition()
let vAsset = AVURLAsset(url: tmpVideo)
guard let vTrack = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
      let vSrc = vAsset.tracks(withMediaType: .video).first else {
    FileHandle.standardError.write("no vtrack\n".data(using: .utf8)!); exit(5) }
try? vTrack.insertTimeRange(CMTimeRange(start: .zero, duration: vAsset.duration), of: vSrc, at: .zero)
if let aa = audioAsset, let aSrc = aa.tracks(withMediaType: .audio).first,
   let aTrack = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
    let aLen = min(aa.duration, vAsset.duration)
    try? aTrack.insertTimeRange(CMTimeRange(start: .zero, duration: aLen), of: aSrc, at: CMTime(value: 4, timescale: 10))
}
try? FileManager.default.removeItem(at: outURL)
guard let export = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetHighestQuality) else {
    FileHandle.standardError.write("no export\n".data(using: .utf8)!); exit(6) }
export.outputURL = outURL; export.outputFileType = .mp4
let sem2 = DispatchSemaphore(value: 0)
export.exportAsynchronously { sem2.signal() }; sem2.wait()
try? FileManager.default.removeItem(at: tmpVideo)
if export.status == .completed { print("OK \(outURL.path)"); exit(0) }
FileHandle.standardError.write("export failed: \(String(describing: export.error))\n".data(using: .utf8)!); exit(7)
