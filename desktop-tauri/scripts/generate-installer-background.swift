import AppKit
import Foundation

let arguments = CommandLine.arguments

guard arguments.count >= 3 else {
    fputs("Usage: swift generate-installer-background.swift <output-path> <product-name> [logo-path]\n", stderr)
    exit(1)
}

let outputPath = arguments[1]
let productName = arguments[2]
let logoPath = arguments.count > 3 ? arguments[3] : nil
let canvasSize = NSSize(width: 780, height: 520)

let bitmap = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: Int(canvasSize.width),
    pixelsHigh: Int(canvasSize.height),
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
)

guard let imageRep = bitmap else {
    fputs("Failed to create bitmap context.\n", stderr)
    exit(1)
}

guard let graphicsContext = NSGraphicsContext(bitmapImageRep: imageRep) else {
    fputs("Failed to create graphics context.\n", stderr)
    exit(1)
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = graphicsContext

let rect = NSRect(origin: .zero, size: canvasSize)

let baseGradient = NSGradient(colors: [
    NSColor(calibratedRed: 0.03, green: 0.03, blue: 0.05, alpha: 1.0),
    NSColor(calibratedRed: 0.09, green: 0.06, blue: 0.02, alpha: 1.0),
    NSColor(calibratedRed: 0.02, green: 0.02, blue: 0.03, alpha: 1.0),
])
baseGradient?.draw(in: rect, angle: -18)

let glowGradient = NSGradient(colors: [
    NSColor(calibratedRed: 0.90, green: 0.73, blue: 0.22, alpha: 0.28),
    NSColor(calibratedRed: 0.90, green: 0.73, blue: 0.22, alpha: 0.0),
])
let glowRect = NSRect(x: 190, y: 115, width: 420, height: 260)
glowGradient?.draw(in: glowRect, relativeCenterPosition: .zero)

let panelPath = NSBezierPath(roundedRect: NSRect(x: 28, y: 36, width: 724, height: 448), xRadius: 28, yRadius: 28)
NSColor(calibratedWhite: 1.0, alpha: 0.05).setFill()
panelPath.fill()
NSColor(calibratedRed: 0.84, green: 0.67, blue: 0.18, alpha: 0.35).setStroke()
panelPath.lineWidth = 1.5
panelPath.stroke()

let titleAttributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 34, weight: .bold),
    .foregroundColor: NSColor(calibratedWhite: 0.98, alpha: 1.0),
]
let subtitleAttributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 15, weight: .medium),
    .foregroundColor: NSColor(calibratedWhite: 0.92, alpha: 0.82),
]
let eyebrowAttributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 12, weight: .semibold),
    .foregroundColor: NSColor(calibratedRed: 0.89, green: 0.76, blue: 0.36, alpha: 0.95),
]

NSAttributedString(string: "Drag to install", attributes: eyebrowAttributes)
    .draw(at: NSPoint(x: 58, y: 430))
NSAttributedString(string: "Install \(productName) into Applications", attributes: titleAttributes)
    .draw(at: NSPoint(x: 56, y: 386))
NSAttributedString(
    string: "Local-first PrismAI, packaged cleanly for macOS. Drop the app onto Applications to finish the install.",
    attributes: subtitleAttributes
).draw(with: NSRect(x: 58, y: 340, width: 650, height: 44), options: [.usesLineFragmentOrigin])

let arrowPath = NSBezierPath()
arrowPath.move(to: NSPoint(x: 292, y: 214))
arrowPath.curve(to: NSPoint(x: 500, y: 214), controlPoint1: NSPoint(x: 348, y: 214), controlPoint2: NSPoint(x: 448, y: 214))
arrowPath.lineWidth = 8
NSColor(calibratedRed: 0.93, green: 0.78, blue: 0.30, alpha: 0.85).setStroke()
arrowPath.stroke()

let arrowHead = NSBezierPath()
arrowHead.move(to: NSPoint(x: 500, y: 214))
arrowHead.line(to: NSPoint(x: 468, y: 238))
arrowHead.move(to: NSPoint(x: 500, y: 214))
arrowHead.line(to: NSPoint(x: 468, y: 190))
arrowHead.lineWidth = 8
arrowHead.lineCapStyle = .round
arrowHead.lineJoinStyle = .round
arrowHead.stroke()

let leftLabelAttributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 14, weight: .semibold),
    .foregroundColor: NSColor(calibratedWhite: 0.96, alpha: 0.95),
]
NSAttributedString(string: "\(productName).app", attributes: leftLabelAttributes)
    .draw(at: NSPoint(x: 120, y: 120))
NSAttributedString(string: "Applications", attributes: leftLabelAttributes)
    .draw(at: NSPoint(x: 554, y: 120))

let footerAttributes: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 11, weight: .regular),
    .foregroundColor: NSColor(calibratedWhite: 0.85, alpha: 0.7),
]
NSAttributedString(
    string: "PrismAI bundles modified AnythingLLM components under the MIT License. Open-source notices are available from the Help menu after install.",
    attributes: footerAttributes
).draw(with: NSRect(x: 58, y: 52, width: 664, height: 34), options: [.usesLineFragmentOrigin])

if let logoPath, let logoImage = NSImage(contentsOfFile: logoPath) {
    let logoRect = NSRect(x: 612, y: 326, width: 112, height: 112)
    logoImage.draw(in: logoRect, from: .zero, operation: .sourceOver, fraction: 0.23)
}

graphicsContext.flushGraphics()
NSGraphicsContext.restoreGraphicsState()

guard let pngData = imageRep.representation(using: .png, properties: [:]) else {
    fputs("Failed to encode PNG output.\n", stderr)
    exit(1)
}

do {
    try pngData.write(to: URL(fileURLWithPath: outputPath))
} catch {
    fputs("Failed to write installer background: \(error.localizedDescription)\n", stderr)
    exit(1)
}
