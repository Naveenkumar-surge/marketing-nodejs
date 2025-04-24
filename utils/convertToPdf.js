import PDFDocument from 'pdfkit';

/**
 * Converts an image buffer to a PDF buffer
 * @param {Buffer} imageBuffer
 * @returns {Promise<Buffer>}
 */
export const convertImageBufferToPdf = (imageBuffer) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Add a page and image
    doc.addPage();
    doc.image(imageBuffer, {
      fit: [500, 700],
      align: 'center',
      valign: 'center'
    });

    doc.end();
  });
};
