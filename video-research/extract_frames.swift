// Pull still frames out of a local video at given timestamps. AVFoundation only.
//
// Written in Swift rather than reaching for ffmpeg because this machine has no Homebrew and
// no ffmpeg, but it does have AVFoundation — the same framework marketing/video/render.swift
// already uses to WRITE video. This reads it back.
//
// Usage:  swift extract_frames.swift <video.mp4> <out-dir> <ms,ms,ms,...>
//
// Each frame is written as <out-dir>/<ms>.jpg. Timestamps that fall outside the asset are
// reported and skipped rather than clamped to the nearest valid one: a frame labelled
// 41:03 that is actually the last frame of the video would be evidence for a claim about a
// moment that was never looked at.

import AVFoundation
import AppKit
import Foundation

let args = CommandLine.arguments
guard args.count >= 4 else {
    FileHandle.standardError.write(
        "usage: extract_frames.swift <video> <out-dir> <ms,ms,...>\n".data(using: .utf8)!)
    exit(2)
}

let videoPath = args[1]
let outDir = args[2]
let stamps = args[3].split(separator: ",").compactMap { Int64($0.trimmingCharacters(in: .whitespaces)) }

guard FileManager.default.fileExists(atPath: videoPath) else {
    FileHandle.standardError.write("no such video: \(videoPath)\n".data(using: .utf8)!)
    exit(2)
}
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

let asset = AVURLAsset(url: URL(fileURLWithPath: videoPath))
let durationMs = Int64(CMTimeGetSeconds(asset.duration) * 1000)

let generator = AVAssetImageGenerator(asset: asset)
generator.appliesPreferredTrackTransform = true
// Exact frames, not the nearest keyframe. A keyframe can be seconds away, which on a chart
// is a different drawing — the tolerance is the difference between evidence and decoration.
generator.requestedTimeToleranceBefore = .zero
generator.requestedTimeToleranceAfter = .zero

var written = 0
var skipped = 0

for ms in stamps {
    if ms < 0 || ms > durationMs {
        FileHandle.standardError.write(
            "skip \(ms)ms: outside asset duration \(durationMs)ms\n".data(using: .utf8)!)
        skipped += 1
        continue
    }
    let time = CMTime(value: CMTimeValue(ms), timescale: 1000)
    do {
        let cgImage = try generator.copyCGImage(at: time, actualTime: nil)
        let rep = NSBitmapImageRep(cgImage: cgImage)
        // JPEG at 0.8: the price axis stays legible, which is the whole reason for the
        // frame, while a PNG of the same chart runs several times larger for no gain.
        guard let data = rep.representation(using: .jpeg,
                                            properties: [.compressionFactor: 0.8]) else {
            FileHandle.standardError.write("skip \(ms)ms: encode failed\n".data(using: .utf8)!)
            skipped += 1
            continue
        }
        let path = "\(outDir)/\(ms).jpg"
        try data.write(to: URL(fileURLWithPath: path))
        print("\(ms)\t\(path)\t\(cgImage.width)\t\(cgImage.height)\t\(data.count)")
        written += 1
    } catch {
        FileHandle.standardError.write("skip \(ms)ms: \(error)\n".data(using: .utf8)!)
        skipped += 1
    }
}

FileHandle.standardError.write(
    "wrote \(written), skipped \(skipped), asset \(durationMs)ms\n".data(using: .utf8)!)
exit(written > 0 ? 0 : 1)
