// Lightning Mines — daily short renderer.
// Built entirely on Apple frameworks (AppKit + CoreGraphics + AVFoundation).
// No Homebrew, no ffmpeg, no third-party packages.
//
// Usage: render <spec.json> <audio.aiff> <out.mp4>
//
// spec.json shape:
// { "title": "...", "lines": [{"label","value","tone"}], "verdict": "...", "cta": "..." }

import AppKit
import AVFoundation
import CoreMedia

// ── Args ──
let args = CommandLine.arguments
guard args.count == 4 else {
    FileHandle.standardError.write("usage: render <spec.json> <audio.aiff> <out.mp4>\n".data(using: .utf8)!)
    exit(2)
}
let specURL = URL(fileURLWithPath: args[1])
let audioURL = URL(fileURLWithPath: args[2])
let outURL = URL(fileURLWithPath: args[3])

// ── Spec ──
struct Line: Decodable { let label: String; let value: String; let tone: String }
struct Spec: Decodable { let title: String; let lines: [Line]; let verdict: String; let cta: String }

let spec: Spec
do {
    spec = try JSONDecoder().decode(Spec.self, from: Data(contentsOf: specURL))
} catch {
    FileHandle.standardError.write("bad spec: \(error)\n".data(using: .utf8)!)
    exit(3)
}

// ── Brand palette ──
func hex(_ h: UInt32) -> NSColor {
    NSColor(srgbRed: CGFloat((h >> 16) & 0xff)/255, green: CGFloat((h >> 8) & 0xff)/255,
            blue: CGFloat(h & 0xff)/255, alpha: 1)
}
let BG     = hex(0x0a0a0a)
let AMBER  = hex(0xf59e0b)
let TEAL   = hex(0x00d4aa)
let RED    = hex(0xef4444)
let WHITE  = hex(0xffffff)
let GRAY   = hex(0x9ca3af)
let PANEL  = hex(0x111111)

func toneColor(_ t: String) -> NSColor { t == "pos" ? TEAL : (t == "neg" ? RED : WHITE) }

// ── Geometry / timing ──
let W = 1080, H = 1920
let fps: Int32 = 30
let audioAsset = AVURLAsset(url: audioURL)
let audioDur = CMTimeGetSeconds(audioAsset.duration)
let total = max(12.0, (audioDur > 0 ? audioDur : 20.0) + 1.2)
let frameCount = Int(total * Double(fps))

// ── Video writer (H.264, video-only temp) ──
let tmpVideo = URL(fileURLWithPath: NSTemporaryDirectory())
    .appendingPathComponent("lm_vid_\(UUID().uuidString).mp4")
try? FileManager.default.removeItem(at: tmpVideo)

let writer = try! AVAssetWriter(outputURL: tmpVideo, fileType: .mp4)
let vSettings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: W,
    AVVideoHeightKey: H,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 6_000_000,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel,
    ],
]
let vInput = AVAssetWriterInput(mediaType: .video, outputSettings: vSettings)
vInput.expectsMediaDataInRealTime = false
let adaptor = AVAssetWriterInputPixelBufferAdaptor(
    assetWriterInput: vInput,
    sourcePixelBufferAttributes: [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
        kCVPixelBufferWidthKey as String: W,
        kCVPixelBufferHeightKey as String: H,
    ])
writer.add(vInput)
writer.startWriting()
writer.startSession(atSourceTime: .zero)

// ── Text helpers ──
func draw(_ s: String, font: NSFont, color: NSColor, x: CGFloat, y: CGFloat,
          align: NSTextAlignment = .left, maxW: CGFloat, alpha: CGFloat = 1) {
    let para = NSMutableParagraphStyle(); para.alignment = align
    para.lineBreakMode = .byWordWrapping
    let attrs: [NSAttributedString.Key: Any] = [
        .font: font, .foregroundColor: color.withAlphaComponent(alpha), .paragraphStyle: para,
    ]
    let str = NSAttributedString(string: s, attributes: attrs)
    let rect = NSRect(x: x, y: y, width: maxW, height: 400)
    str.draw(with: rect, options: [.usesLineFragmentOrigin], context: nil)
}

func measureH(_ s: String, font: NSFont, maxW: CGFloat) -> CGFloat {
    let para = NSMutableParagraphStyle(); para.lineBreakMode = .byWordWrapping
    let str = NSAttributedString(string: s, attributes: [.font: font, .paragraphStyle: para])
    return str.boundingRect(with: NSSize(width: maxW, height: 800),
                            options: [.usesLineFragmentOrigin]).height
}

// simple ease
func ease(_ t: CGFloat) -> CGFloat { t < 0 ? 0 : (t > 1 ? 1 : (t*t*(3 - 2*t))) }

let bold  = { (s: CGFloat) in NSFont.systemFont(ofSize: s, weight: .bold) }
let heavy = { (s: CGFloat) in NSFont.systemFont(ofSize: s, weight: .heavy) }
let mono  = { (s: CGFloat) in NSFont.monospacedDigitSystemFont(ofSize: s, weight: .heavy) }
let med   = { (s: CGFloat) in NSFont.systemFont(ofSize: s, weight: .semibold) }

let margin: CGFloat = 80
let contentW = CGFloat(W) - margin*2

// ── Render loop ──
for f in 0..<frameCount {
    let t = Double(f) / Double(fps)

    var pbOut: CVPixelBuffer?
    CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pbOut)
    guard let pb = pbOut else { continue }
    CVPixelBufferLockBaseAddress(pb, [])
    let ctx = CGContext(
        data: CVPixelBufferGetBaseAddress(pb),
        width: W, height: H, bitsPerComponent: 8,
        bytesPerRow: CVPixelBufferGetBytesPerRow(pb),
        space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue
            | CGBitmapInfo.byteOrder32Little.rawValue)!

    // CVPixelBuffer memory row 0 is the top of the frame, but a CGContext uses a
    // bottom-left origin — flip the CTM so top-left layout maps correctly, then
    // pair with a flipped NSGraphicsContext so text still renders upright.
    ctx.translateBy(x: 0, y: CGFloat(H))
    ctx.scaleBy(x: 1, y: -1)

    let ns = NSGraphicsContext(cgContext: ctx, flipped: true)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = ns

    // background
    BG.setFill(); NSRect(x: 0, y: 0, width: W, height: H).fill()
    // top amber hairline accent
    AMBER.withAlphaComponent(0.9).setFill()
    NSRect(x: 0, y: 0, width: W, height: 8).fill()

    var y: CGFloat = 150

    // wordmark: amber bolt + LIGHTNING MINES
    let boltX: CGFloat = margin
    let bolt = NSBezierPath()
    bolt.move(to: NSPoint(x: boltX+22, y: y+2))
    bolt.line(to: NSPoint(x: boltX+2,  y: y+30))
    bolt.line(to: NSPoint(x: boltX+18, y: y+30))
    bolt.line(to: NSPoint(x: boltX+14, y: y+52))
    bolt.line(to: NSPoint(x: boltX+34, y: y+22))
    bolt.line(to: NSPoint(x: boltX+18, y: y+22))
    bolt.close(); AMBER.setFill(); bolt.fill()
    draw("LIGHTNING MINES", font: med(30), color: GRAY, x: boltX+50, y: y+8, maxW: 500)

    y += 110

    // title (fade in fast)
    let titleAlpha = ease(CGFloat((t - 0.15) / 0.35))
    draw(spec.title, font: heavy(74), color: AMBER, x: margin, y: y, maxW: contentW, alpha: titleAlpha)
    y += measureH(spec.title, font: heavy(74), maxW: contentW) + 60

    // number rows, staggered reveal
    let rowStart = 0.6
    let rowGap = 0.45
    for (i, line) in spec.lines.enumerated() {
        let appear = rowStart + Double(i) * rowGap
        let a = ease(CGFloat((t - appear) / 0.35))
        if a <= 0.001 { y += 150; continue }
        let rise = (1 - a) * 24
        let ry = y + rise
        // panel
        PANEL.withAlphaComponent(0.9 * a).setFill()
        let panel = NSBezierPath(roundedRect: NSRect(x: margin, y: ry, width: contentW, height: 118),
                                 xRadius: 16, yRadius: 16)
        panel.fill()
        draw(line.label, font: med(30), color: GRAY, x: margin+30, y: ry+22, maxW: contentW-60, alpha: a)
        draw(line.value, font: mono(58), color: toneColor(line.tone),
             x: margin+30, y: ry+50, align: .right, maxW: contentW-60, alpha: a)
        y += 150
    }

    y += 30
    // verdict
    let vA = ease(CGFloat((t - (rowStart + Double(spec.lines.count)*rowGap)) / 0.4))
    draw(spec.verdict, font: bold(46), color: WHITE, x: margin, y: y, maxW: contentW, alpha: vA)

    // CTA pill near bottom
    let ctaA = ease(CGFloat((t - (rowStart + Double(spec.lines.count)*rowGap + 0.4)) / 0.4))
    if ctaA > 0.001 {
        let pillH: CGFloat = 96, pillY = CGFloat(H) - 220
        AMBER.withAlphaComponent(ctaA).setFill()
        NSBezierPath(roundedRect: NSRect(x: margin, y: pillY, width: contentW, height: pillH),
                     xRadius: 20, yRadius: 20).fill()
        draw("Run your numbers  →  \(spec.cta)", font: heavy(40), color: hex(0x000000),
             x: margin, y: pillY+26, align: .center, maxW: contentW, alpha: ctaA)
    }
    // AI disclosure footer
    draw("AI-generated narration · not financial advice", font: med(22), color: GRAY,
         x: margin, y: CGFloat(H) - 90, align: .center, maxW: contentW, alpha: 0.8)

    NSGraphicsContext.restoreGraphicsState()
    CVPixelBufferUnlockBaseAddress(pb, [])

    while !vInput.isReadyForMoreMediaData { usleep(2000) }
    adaptor.append(pb, withPresentationTime: CMTime(value: CMTimeValue(f), timescale: fps))
}

vInput.markAsFinished()
let sem = DispatchSemaphore(value: 0)
writer.finishWriting { sem.signal() }
sem.wait()
if writer.status != .completed {
    FileHandle.standardError.write("video write failed: \(String(describing: writer.error))\n".data(using: .utf8)!)
    exit(4)
}

// ── Mux voiceover into final MP4 ──
let comp = AVMutableComposition()
let vAsset = AVURLAsset(url: tmpVideo)
guard let vTrack = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid),
      let vSrc = vAsset.tracks(withMediaType: .video).first else {
    FileHandle.standardError.write("no video track\n".data(using: .utf8)!); exit(5)
}
try? vTrack.insertTimeRange(CMTimeRange(start: .zero, duration: vAsset.duration), of: vSrc, at: .zero)

if let aSrc = audioAsset.tracks(withMediaType: .audio).first,
   let aTrack = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid) {
    let aLen = min(audioAsset.duration, vAsset.duration)
    try? aTrack.insertTimeRange(CMTimeRange(start: .zero, duration: aLen), of: aSrc, at: CMTime(value: 3, timescale: 10))
}

try? FileManager.default.removeItem(at: outURL)
guard let export = AVAssetExportSession(asset: comp, presetName: AVAssetExportPresetHighestQuality) else {
    FileHandle.standardError.write("no export session\n".data(using: .utf8)!); exit(6)
}
export.outputURL = outURL
export.outputFileType = .mp4
let sem2 = DispatchSemaphore(value: 0)
export.exportAsynchronously { sem2.signal() }
sem2.wait()
try? FileManager.default.removeItem(at: tmpVideo)

if export.status == .completed {
    print("OK \(outURL.path)")
    exit(0)
} else {
    FileHandle.standardError.write("export failed: \(String(describing: export.error))\n".data(using: .utf8)!)
    exit(7)
}
