export function parseTrackLengthToMeters(text: string): number {
    // example:  "9F 207Y"  or "1531Y"
    const furlongMatch = text.match(/([0-9]+)\s*F/i);
    const yardMatch = text.match(/([0-9]+)\s*Y/i);
    const furlongs = furlongMatch ? parseInt(furlongMatch[1], 10) : 0;
    const yards = yardMatch ? parseInt(yardMatch[1], 10) : 0;
    const meters = (furlongs * 201.168) + (yards * 0.9144);
    return meters;
}
