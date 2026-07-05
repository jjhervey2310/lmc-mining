// Lightning Mines — daily Instagram carousel generator.
// Outputs 1080x1350 PNG slides, each one idea with a swipe hook.
// Apple frameworks only. Usage: carousel <spec.json> <outDir> <datePrefix>

import AppKit
import CoreGraphics

let args = CommandLine.arguments
guard args.count == 4 else {
    FileHandle.standardError.write("usage: carousel <spec.json> <outDir> <prefix>\n".data(using: .utf8)!); exit(2)
}
let spec = try JSONSerialization.jsonObject(with: Data(contentsOf: URL(fileURLWithPath: args[1]))) as! [String: Any]
let outDir = args[2]; let prefix = args[3]

struct Slide {
    var tag = "", headline = "", sub = "", value = "", tone = "neutral", hookNext = "", cta = ""
    var chart = false
}
let rawSlides = (spec["slides"] as? [[String: Any]]) ?? []
let slides: [Slide] = rawSlides.map { d in
    Slide(tag: d["tag"] as? String ?? "", headline: d["headline"] as? String ?? "",
          sub: d["sub"] as? String ?? "", value: d["value"] as? String ?? "",
          tone: d["tone"] as? String ?? "neutral", hookNext: d["hookNext"] as? String ?? "",
          cta: d["cta"] as? String ?? "", chart: d["chart"] as? Bool ?? false)
}
let chartPts: [Double] = ((spec["chart"] as? [String: Any])?["points"] as? [Double]) ?? []
let chartLabel = (spec["chart"] as? [String: Any])?["label"] as? String ?? "BTC · LAST 7 DAYS"

func hex(_ h: UInt32) -> NSColor {
    NSColor(srgbRed: CGFloat((h >> 16) & 0xff)/255, green: CGFloat((h >> 8) & 0xff)/255,
            blue: CGFloat(h & 0xff)/255, alpha: 1)
}
let BG = hex(0x080808), AMBER = hex(0xf59e0b), TEAL = hex(0x00d4aa), RED = hex(0xef4444)
let WHITE = hex(0xffffff), GRAY = hex(0x9ca3af), PANEL = hex(0x14140f), BLACK = hex(0x000000)
func toneColor(_ t: String) -> NSColor { t == "pos" ? TEAL : (t == "neg" ? RED : WHITE) }

let W = 1080, Hs = 1350
let margin: CGFloat = 84
let contentW = CGFloat(W) - margin*2

let heavy = { (s: CGFloat) in NSFont.systemFont(ofSize: s, weight: .heavy) }
let bold  = { (s: CGFloat) in NSFont.systemFont(ofSize: s, weight: .bold) }
let mono  = { (s: CGFloat) in NSFont.monospacedDigitSystemFont(ofSize: s, weight: .heavy) }
let med   = { (s: CGFloat) in NSFont.systemFont(ofSize: s, weight: .semibold) }

func draw(_ s: String, font: NSFont, color: NSColor, x: CGFloat, y: CGFloat,
          align: NSTextAlignment = .left, maxW: CGFloat) {
    if s.isEmpty { return }
    let para = NSMutableParagraphStyle(); para.alignment = align; para.lineBreakMode = .byWordWrapping
    para.lineSpacing = 4
    NSAttributedString(string: s, attributes: [.font: font, .foregroundColor: color, .paragraphStyle: para])
        .draw(with: NSRect(x: x, y: y, width: maxW, height: 700),
              options: [.usesLineFragmentOrigin], context: nil)
}
func measureH(_ s: String, font: NSFont, maxW: CGFloat) -> CGFloat {
    let para = NSMutableParagraphStyle(); para.lineBreakMode = .byWordWrapping; para.lineSpacing = 4
    return NSAttributedString(string: s, attributes: [.font: font, .paragraphStyle: para])
        .boundingRect(with: NSSize(width: maxW, height: 900), options: [.usesLineFragmentOrigin]).height
}

func renderSlide(_ i: Int, _ s: Slide) {
    let ctx = CGContext(data: nil, width: W, height: Hs, bitsPerComponent: 8, bytesPerRow: 0,
        space: CGColorSpace(name: CGColorSpace.sRGB)!,
        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue)!
    ctx.translateBy(x: 0, y: CGFloat(Hs)); ctx.scaleBy(x: 1, y: -1)
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: ctx, flipped: true)

    // background + glow + top bar
    BG.setFill(); NSRect(x: 0, y: 0, width: W, height: Hs).fill()
    let glow = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(),
        colors: [AMBER.withAlphaComponent(0.18).cgColor, AMBER.withAlphaComponent(0).cgColor] as CFArray, locations: [0,1])!
    ctx.drawRadialGradient(glow, startCenter: CGPoint(x: CGFloat(W)/2, y: 260), startRadius: 0,
        endCenter: CGPoint(x: CGFloat(W)/2, y: 260), endRadius: 760, options: [])
    AMBER.setFill(); NSRect(x: 0, y: 0, width: W, height: 7).fill()

    // wordmark
    let bx = margin, by: CGFloat = 92
    let bolt = NSBezierPath()
    bolt.move(to: NSPoint(x: bx+20, y: by+2)); bolt.line(to: NSPoint(x: bx+2, y: by+27))
    bolt.line(to: NSPoint(x: bx+16, y: by+27)); bolt.line(to: NSPoint(x: bx+12, y: by+47))
    bolt.line(to: NSPoint(x: bx+30, y: by+20)); bolt.line(to: NSPoint(x: bx+16, y: by+20)); bolt.close()
    AMBER.setFill(); bolt.fill()
    draw("LIGHTNING MINES", font: med(26), color: GRAY, x: bx+44, y: by+7, maxW: 400)

    var y: CGFloat = 240
    if !s.tag.isEmpty {
        draw(s.tag.uppercased(), font: heavy(30), color: AMBER, x: margin, y: y, maxW: contentW)
        y += 58
    }
    // headline
    let hFont = heavy(s.headline.count > 42 ? 62 : 74)
    draw(s.headline, font: hFont, color: WHITE, x: margin, y: y, maxW: contentW)
    y += measureH(s.headline, font: hFont, maxW: contentW) + 40

    // giant value
    if !s.value.isEmpty {
        draw(s.value, font: mono(120), color: toneColor(s.tone), x: margin, y: y, maxW: contentW)
        y += 150
    }

    // chart panel
    if s.chart && chartPts.count >= 2 {
        let ph: CGFloat = 460
        PANEL.withAlphaComponent(0.9).setFill()
        NSBezierPath(roundedRect: NSRect(x: margin, y: y, width: contentW, height: ph), xRadius: 22, yRadius: 22).fill()
        draw(chartLabel, font: med(26), color: GRAY, x: margin+34, y: y+26, maxW: contentW-68)
        let first = chartPts.first!, last = chartPts.last!
        let chg = first != 0 ? (last-first)/first*100 : 0
        draw(String(format: "%@%.1f%%", chg >= 0 ? "+" : "", chg), font: heavy(34),
             color: chg >= 0 ? TEAL : RED, x: margin+34, y: y+22, align: .right, maxW: contentW-68)
        let px = margin+40, pw = contentW-80, pyTop = y+108, pyBot = y+ph-46
        let lo = chartPts.min()!, hi = chartPts.max()!, span = max(hi-lo, 1)
        func X(_ k: Int) -> CGFloat { px + pw*CGFloat(k)/CGFloat(chartPts.count-1) }
        func Y(_ v: Double) -> CGFloat { pyBot - CGFloat((v-lo)/span)*(pyBot-pyTop) }
        GRAY.withAlphaComponent(0.12).setStroke()
        for g in 0...2 { let gy = pyTop + (pyBot-pyTop)*CGFloat(g)/2
            let gl = NSBezierPath(); gl.lineWidth = 1
            gl.move(to: NSPoint(x: px, y: gy)); gl.line(to: NSPoint(x: px+pw, y: gy)); gl.stroke() }
        var poly: [NSPoint] = []; for k in 0..<chartPts.count { poly.append(NSPoint(x: X(k), y: Y(chartPts[k]))) }
        let area = NSBezierPath(); area.move(to: NSPoint(x: poly[0].x, y: pyBot))
        for p in poly { area.line(to: p) }; area.line(to: NSPoint(x: poly.last!.x, y: pyBot)); area.close()
        AMBER.withAlphaComponent(0.14).setFill(); area.fill()
        let line = NSBezierPath(); line.lineWidth = 5; line.lineJoinStyle = .round; line.lineCapStyle = .round
        line.move(to: poly[0]); for p in poly.dropFirst() { line.line(to: p) }; AMBER.setStroke(); line.stroke()
        let tip = poly.last!
        WHITE.setFill(); NSBezierPath(ovalIn: NSRect(x: tip.x-9, y: tip.y-9, width: 18, height: 18)).fill()
        AMBER.setFill(); NSBezierPath(ovalIn: NSRect(x: tip.x-6, y: tip.y-6, width: 12, height: 12)).fill()
        y += ph + 40
    }

    // sub
    if !s.sub.isEmpty { draw(s.sub, font: med(38), color: GRAY, x: margin, y: y, maxW: contentW) }

    // bottom: CTA pill or swipe hook
    if !s.cta.isEmpty {
        let pillY = CGFloat(Hs) - 250, pillH: CGFloat = 104
        AMBER.setFill()
        NSBezierPath(roundedRect: NSRect(x: margin, y: pillY, width: contentW, height: pillH), xRadius: 24, yRadius: 24).fill()
        draw(s.cta, font: heavy(44), color: BLACK, x: margin, y: pillY+28, align: .center, maxW: contentW)
    } else if !s.hookNext.isEmpty {
        draw(s.hookNext, font: bold(40), color: AMBER, x: margin, y: CGFloat(Hs)-230, align: .left, maxW: contentW)
    }

    // page dots
    let n = slides.count, dotY: CGFloat = CGFloat(Hs) - 110
    let dw: CGFloat = 18, dgap: CGFloat = 14
    let totW = CGFloat(n)*dw + CGFloat(n-1)*dgap
    var dx = (CGFloat(W)-totW)/2
    for k in 0..<n {
        (k == i ? AMBER : GRAY.withAlphaComponent(0.4)).setFill()
        NSBezierPath(ovalIn: NSRect(x: dx, y: dotY, width: dw, height: dw)).fill()
        dx += dw + dgap
    }

    NSGraphicsContext.restoreGraphicsState()
    let img = ctx.makeImage()!
    let url = URL(fileURLWithPath: "\(outDir)/\(prefix)-slide-\(i+1).png")
    try? NSBitmapImageRep(cgImage: img).representation(using: .png, properties: [:])!.write(to: url)
}

for (i, s) in slides.enumerated() { renderSlide(i, s) }
print("OK \(slides.count) slides")
