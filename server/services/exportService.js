const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} = require('docx');
const PdfPrinter = require('pdfmake');
const { flattenResultForExport, formatSectionValue } = require('../utils/formatters');

function loadPdfFonts() {
  // eslint-disable-next-line global-require
  const vfs = require('pdfmake/build/vfs_fonts');
  return {
    Roboto: {
      normal: Buffer.from(vfs['Roboto-Regular.ttf'], 'base64'),
      bold: Buffer.from(vfs['Roboto-Medium.ttf'], 'base64'),
      italics: Buffer.from(vfs['Roboto-Italic.ttf'], 'base64'),
      bolditalics: Buffer.from(vfs['Roboto-MediumItalic.ttf'], 'base64'),
    },
  };
}

/**
 * @param {string} workflowTitle
 * @param {object} result
 * @param {Array<{key:string,title:string,type:string}>} sections
 */
function buildPdfContent(workflowTitle, result, sections) {
  const content = [
    { text: 'WorkflowGPT', style: 'brand', margin: [0, 0, 0, 4] },
    { text: workflowTitle, style: 'header', margin: [0, 0, 0, 16] },
    {
      canvas: [
        { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#2aabee' },
      ],
      margin: [0, 0, 0, 20],
    },
  ];

  for (const section of sections) {
    const value = result[section.key];
    const body = formatSectionValue(value, section.type);
    if (!body) continue;

    content.push({ text: section.title, style: 'sectionTitle', margin: [0, 12, 0, 6] });

    if (section.type === 'list' && Array.isArray(value)) {
      content.push({
        ul: value.map((item) => ({ text: item, margin: [0, 2, 0, 2] })),
        margin: [0, 0, 0, 8],
      });
    } else if (section.type === 'swot' && value && typeof value === 'object') {
      const quadrants = [
        ['Сильные стороны', value.strengths],
        ['Слабые стороны', value.weaknesses],
        ['Возможности', value.opportunities],
        ['Угрозы', value.threats],
      ];
      for (const [label, items] of quadrants) {
        if (Array.isArray(items) && items.length) {
          content.push({ text: label, style: 'swotLabel', margin: [0, 6, 0, 2] });
          content.push({ ul: items.map((i) => ({ text: i })), margin: [0, 0, 0, 4] });
        }
      }
    } else {
      content.push({ text: body, style: 'body', margin: [0, 0, 0, 10] });
    }
  }

  content.push({
    text: 'Сгенерировано WorkflowGPT · Telegram Mini App',
    style: 'footer',
    margin: [0, 24, 0, 0],
  });

  return content;
}

/**
 * @returns {Promise<Buffer>}
 */
async function exportToPdf(workflowTitle, result, sections) {
  const printer = new PdfPrinter(loadPdfFonts());
  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [48, 56, 48, 56],
    defaultStyle: { font: 'Roboto', fontSize: 11, color: '#1a1a1e' },
    styles: {
      brand: { fontSize: 10, color: '#2aabee', bold: true },
      header: { fontSize: 20, bold: true, color: '#0a0a0c' },
      sectionTitle: { fontSize: 14, bold: true, color: '#2aabee' },
      swotLabel: { fontSize: 11, bold: true, color: '#555555' },
      body: { fontSize: 11, lineHeight: 1.35 },
      footer: { fontSize: 9, color: '#888888', italics: true },
    },
    content: buildPdfContent(workflowTitle, result, sections),
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const chunks = [];

  return new Promise((resolve, reject) => {
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
}

function buildDocxParagraphs(workflowTitle, result, sections) {
  const children = [
    new Paragraph({ text: 'WorkflowGPT', heading: HeadingLevel.HEADING_3 }),
    new Paragraph({ text: workflowTitle, heading: HeadingLevel.HEADING_1, spacing: { after: 300 } }),
  ];

  for (const section of sections) {
    const value = result[section.key];
    if (value === undefined || value === null) continue;

    children.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 120 },
      })
    );

    if (section.type === 'list' && Array.isArray(value)) {
      for (const item of value) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `• ${item}` })],
            spacing: { after: 80 },
          })
        );
      }
    } else if (section.type === 'swot' && typeof value === 'object') {
      const labels = [
        ['Сильные стороны', value.strengths],
        ['Слабые стороны', value.weaknesses],
        ['Возможности', value.opportunities],
        ['Угрозы', value.threats],
      ];
      for (const [label, items] of labels) {
        if (Array.isArray(items) && items.length) {
          children.push(new Paragraph({ text: label, heading: HeadingLevel.HEADING_3 }));
          for (const item of items) {
            children.push(new Paragraph({ children: [new TextRun({ text: `• ${item}` })] }));
          }
        }
      }
    } else {
      const text = formatSectionValue(value, section.type);
      if (text) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text })],
            spacing: { after: 160 },
          })
        );
      }
    }
  }

  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'WorkflowGPT · Telegram Mini App',
          italics: true,
          size: 18,
          color: '888888',
        }),
      ],
      spacing: { before: 400 },
    })
  );

  return children;
}

async function exportToDocx(workflowTitle, result, sections) {
  const doc = new Document({
    sections: [{ properties: {}, children: buildDocxParagraphs(workflowTitle, result, sections) }],
  });
  return Packer.toBuffer(doc);
}

async function buildExport(payload, format) {
  const { workflow: workflowTitle, result, sections } = payload;
  if (!workflowTitle || !result) {
    throw new Error('Invalid export payload');
  }

  if (format === 'pdf') return exportToPdf(workflowTitle, result, sections ?? []);
  if (format === 'docx') return exportToDocx(workflowTitle, result, sections ?? []);
  throw new Error(`Unsupported export format: ${format}`);
}

function getPlainTextReport(workflowTitle, result) {
  return flattenResultForExport(workflowTitle, result);
}

module.exports = {
  exportToPdf,
  exportToDocx,
  buildExport,
  getPlainTextReport,
};
