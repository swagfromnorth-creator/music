import SwiftUI

enum Theme {
    static let background = Color(red: 9 / 255, green: 9 / 255, blue: 13 / 255)
    static let surface = Color(red: 19 / 255, green: 20 / 255, blue: 28 / 255)
    static let surfaceElevated = Color(red: 28 / 255, green: 30 / 255, blue: 42 / 255)
    static let border = Color.white.opacity(0.08)
    static let accent = Color(red: 16 / 255, green: 185 / 255, blue: 129 / 255) // VaultStream Emerald
    static let violet = Color(red: 139 / 255, green: 92 / 255, blue: 246 / 255) // Obsidian Violet
    static let textPrimary = Color.white
    static let textSecondary = Color(red: 161 / 255, green: 166 / 255, blue: 184 / 255)
    static let danger = Color(red: 239 / 255, green: 68 / 255, blue: 68 / 255)
}

extension Color {
    init(hex: String, fallback: Color = Theme.violet) {
        var cleaned = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if cleaned.hasPrefix("#") {
            cleaned.removeFirst()
        }
        guard cleaned.count == 6 || cleaned.count == 8, let intVal = UInt64(cleaned, radix: 16) else {
            self = fallback
            return
        }
        if cleaned.count == 6 {
            let r = Double((intVal >> 16) & 0xFF) / 255.0
            let g = Double((intVal >> 8) & 0xFF) / 255.0
            let b = Double(intVal & 0xFF) / 255.0
            self.init(.sRGB, red: r, green: g, blue: b, opacity: 1.0)
        } else {
            let r = Double((intVal >> 24) & 0xFF) / 255.0
            let g = Double((intVal >> 16) & 0xFF) / 255.0
            let b = Double((intVal >> 8) & 0xFF) / 255.0
            let a = Double(intVal & 0xFF) / 255.0
            self.init(.sRGB, red: r, green: g, blue: b, opacity: a)
        }
    }

    static func parseCSSGradientColors(_ gradient: String?) -> [Color] {
        guard let gradient, !gradient.isEmpty else {
            return [Color(hex: "#6d28d9"), Color(hex: "#10b981")]
        }
        let pattern = "#[0-9a-fA-F]{6}"
        guard let regex = try? NSRegularExpression(pattern: pattern) else {
            return [Color(hex: "#6d28d9"), Color(hex: "#10b981")]
        }
        let nsRange = NSRange(gradient.startIndex..<gradient.endIndex, in: gradient)
        let matches = regex.matches(in: gradient, range: nsRange)
        let colors = matches.compactMap { match -> Color? in
            guard let range = Range(match.range, in: gradient) else { return nil }
            return Color(hex: String(gradient[range]))
        }
        return colors.isEmpty ? [Color(hex: "#6d28d9"), Color(hex: "#10b981")] : colors
    }
}

enum Formatters {
    static func duration(_ seconds: Double?) -> String {
        guard let seconds, seconds.isFinite, seconds >= 0 else { return "0:00" }
        let total = Int(seconds.rounded(.down))
        let mins = total / 60
        let secs = total % 60
        return String(format: "%d:%02d", mins, secs)
    }

    static func bytes(_ count: Int64) -> String {
        let formatter = ByteCountFormatter()
        formatter.countStyle = .file
        return formatter.string(fromByteCount: count)
    }
}
