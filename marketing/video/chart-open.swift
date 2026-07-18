// chart-open.swift — prepend a 2s animated stat/chart open to a vertical MP4.
// Usage: swift chart-open.swift <main.mp4> <out.mp4> <bigNumber> <label> [spark "v1,v2,..."]
// Spark provided  -> chart mode (count-up number + 7-day sparkline). Fresh-numbers videos only.
// Spark omitted   -> episode-card mode (big text only). For evergreen episodes.
import AVFoundation
import AppKit
import CoreGraphics

let args = CommandLine.arguments
guard args.count >= 5 else { fatalError("usage: chart-open.swift main.mp4 out.mp4 bigNumber label [spark]") }
let mainURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])
let bigNumber = args[3]
let label = args[4]
let spark: [Double] = args.count > 5 ? args[5].split(separator: ",").compactMap { Double($0) } : []

let W = 720, H = 1280, FPS = 30, DUR = 2.0
let orange = CGColor(red: 0.97, green: 0.58, blue: 0.10, alpha: 1)
let white = CGColor(red: 1, green: 1, blue: 1, alpha: 1)
let grey = CGColor(red: 0.62, green: 0.62, blue: 0.62, alpha: 1)

func draw(_ ctx: CGContext, t: Double) {
  ctx.setFillColor(CGColor(red: 0.04, green: 0.04, blue: 0.05, alpha: 1))
  ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
  let ease = 1 - pow(1 - min(t / 0.9, 1), 3) // ease-out over first 0.9s

  // Auto-shrinks to fit within the frame (minus side margins) so long labels never clip off-screen.
  func text(_ s: String, size: CGFloat, color: CGColor, weight: NSFont.Weight, y: CGFloat, alpha: CGFloat = 1) {
    let maxWidth = CGFloat(W) - 80
    var fitSize = size
    var line: CTLine
    var b: CGRect
    repeat {
      let font = NSFont.systemFont(ofSize: fitSize, weight: weight)
      let attr = NSAttributedString(string: s, attributes: [.font: font, .foregroundColor: NSColor(cgColor: color)!.withAlphaComponent(alpha)])
      line = CTLineCreateWithAttributedString(attr)
      b = CTLineGetBoundsWithOptions(line, .useOpticalBounds)
      if b.width <= maxWidth || fitSize <= 14 { break }
      fitSize -= 2
    } while true
    ctx.textPosition = CGPoint(x: (CGFloat(W) - b.width) / 2, y: y)
    CTLineDraw(line, ctx)
  }

  text("⚡ LIGHTNING MINES", size: 30, color: orange, weight: .semibold, y: CGFloat(H) - 200, alpha: ease)

  // Count-up on the numeric part of bigNumber (episode-card mode just fades in).
  var shown = bigNumber
  if spark.isEmpty == false, let m = bigNumber.range(of: #"[0-9][0-9,\.]*"#, options: .regularExpression) {
    let numStr = bigNumber[m].replacingOccurrences(of: ",", with: "")
    if let v = Double(numStr) {
      let cur = v * ease
      let decimals = numStr.contains(".") ? numStr.split(separator: ".")[1].count : 0
      let fmt = NumberFormatter(); fmt.numberStyle = .decimal; fmt.minimumFractionDigits = decimals; fmt.maximumFractionDigits = decimals
      shown = bigNumber.replacingCharacters(in: m, with: fmt.string(from: NSNumber(value: cur)) ?? numStr)
    }
  }
  text(shown, size: 110, color: white, weight: .bold, y: CGFloat(H) / 2 + 60, alpha: spark.isEmpty ? ease : 1)
  text(label.uppercased(), size: 34, color: grey, weight: .medium, y: CGFloat(H) / 2 - 30, alpha: ease)

  if spark.count >= 2 {
    let lo = spark.min()!, hi = max(spark.max()!, lo + 1)
    let x0 = 90.0, x1 = Double(W) - 90, y0 = 330.0, y1 = 500.0
    let n = spark.count
    let visible = ease * Double(n - 1) // draw-in left to right
    let path = CGMutablePath()
    for i in 0..<n {
      let f = Double(i)
      if f > visible { break }
      let px = x0 + (x1 - x0) * f / Double(n - 1)
      let py = y0 + (y1 - y0) * (spark[i] - lo) / (hi - lo)
      if path.isEmpty { path.move(to: CGPoint(x: px, y: py)) } else { path.addLine(to: CGPoint(x: px, y: py)) }
    }
    ctx.addPath(path)
    ctx.setStrokeColor(orange)
    ctx.setLineWidth(7)
    ctx.setLineJoin(.round)
    ctx.setLineCap(.round)
    ctx.strokePath()
  }
}

// --- render open clip ---
let openURL = URL(fileURLWithPath: NSTemporaryDirectory() + "chart-open-\(UUID().uuidString).mp4")
let writer = try AVAssetWriter(outputURL: openURL, fileType: .mp4)
let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
  AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: W, AVVideoHeightKey: H,
])
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
  kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32ARGB, kCVPixelBufferWidthKey as String: W, kCVPixelBufferHeightKey as String: H,
])
writer.add(input)
writer.startWriting()
writer.startSession(atSourceTime: .zero)
let frames = Int(DUR * Double(FPS))
for i in 0..<frames {
  while !input.isReadyForMoreMediaData { usleep(5000) }
  var pb: CVPixelBuffer?
  CVPixelBufferPoolCreatePixelBuffer(nil, adaptor.pixelBufferPool!, &pb)
  CVPixelBufferLockBaseAddress(pb!, [])
  let ctx = CGContext(data: CVPixelBufferGetBaseAddress(pb!), width: W, height: H, bitsPerComponent: 8,
                      bytesPerRow: CVPixelBufferGetBytesPerRow(pb!), space: CGColorSpaceCreateDeviceRGB(),
                      bitmapInfo: CGImageAlphaInfo.noneSkipFirst.rawValue)!
  draw(ctx, t: Double(i) / Double(FPS))
  CVPixelBufferUnlockBaseAddress(pb!, [])
  adaptor.append(pb!, withPresentationTime: CMTime(value: Int64(i), timescale: Int32(FPS)))
}
input.markAsFinished()
let sem = DispatchSemaphore(value: 0)
writer.finishWriting { sem.signal() }
sem.wait()

// --- concatenate open + main ---
let comp = AVMutableComposition()
let vTrack = comp.addMutableTrack(withMediaType: .video, preferredTrackID: kCMPersistentTrackID_Invalid)!
let aTrack = comp.addMutableTrack(withMediaType: .audio, preferredTrackID: kCMPersistentTrackID_Invalid)!
let openAsset = AVURLAsset(url: openURL)
let mainAsset = AVURLAsset(url: mainURL)
let openV = openAsset.tracks(withMediaType: .video)[0]
try vTrack.insertTimeRange(CMTimeRange(start: .zero, duration: openAsset.duration), of: openV, at: .zero)
let mainV = mainAsset.tracks(withMediaType: .video)[0]
try vTrack.insertTimeRange(CMTimeRange(start: .zero, duration: mainAsset.duration), of: mainV, at: openAsset.duration)
if let mainA = mainAsset.tracks(withMediaType: .audio).first {
  try aTrack.insertTimeRange(CMTimeRange(start: .zero, duration: mainAsset.duration), of: mainA, at: openAsset.duration)
}
try? FileManager.default.removeItem(at: outURL)
let export = AVAssetExportSession(asset: comp, presetName: AVAssetExportPreset1280x720)!
export.outputURL = outURL
export.outputFileType = .mp4
let sem2 = DispatchSemaphore(value: 0)
export.exportAsynchronously { sem2.signal() }
sem2.wait()
guard export.status == .completed else { fatalError("export failed: \(String(describing: export.error))") }
try? FileManager.default.removeItem(at: openURL)
print("✅ \(outURL.path)")
