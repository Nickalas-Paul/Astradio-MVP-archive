import sharp from 'sharp';

/**
 * Converts an SVG string to a PNG buffer.
 * Uses sharp's built-in SVG support (librsvg).
 */
export async function svgToPng(svgString: string, width: number, height: number): Promise<Buffer> {
  return sharp(Buffer.from(svgString))
    .resize(width, height)
    .png()
    .toBuffer();
}
