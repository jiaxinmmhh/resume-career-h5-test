const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOCUMENT_XML_PATH = 'word/document.xml';

export function isSupportedDocxFile(file) {
  const name = file?.name?.toLowerCase() || '';
  return file?.type === DOCX_MIME || name.endsWith('.docx');
}

function decodeXmlEntities(value) {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

export function extractTextFromDocumentXml(xml) {
  const parts = [];
  const tokenPattern = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:tab\b[^>]*\/>|<w:br\b[^>]*\/>|<\/w:p>/g;
  let match;

  while ((match = tokenPattern.exec(xml))) {
    if (match[1] !== undefined) {
      parts.push(decodeXmlEntities(match[1]));
    } else if (match[0].startsWith('<w:tab')) {
      parts.push('\t');
    } else {
      parts.push('\n');
    }
  }

  return parts
    .join('')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n');
}

function findEndOfCentralDirectory(view) {
  for (let offset = view.byteLength - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      return offset;
    }
  }

  throw new Error('无法读取 DOCX：文件结构不完整。');
}

function getZipEntry(buffer, entryName) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  const eocdOffset = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  let offset = view.getUint32(eocdOffset + 16, true);

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) {
      throw new Error('无法读取 DOCX：目录结构异常。');
    }

    const compressionMethod = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    const nameStart = offset + 46;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + fileNameLength));

    if (name === entryName) {
      const localNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;

      return {
        compressionMethod,
        bytes: bytes.slice(dataStart, dataStart + compressedSize),
      };
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error('无法读取 DOCX：未找到正文内容。');
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器不支持解压 DOCX 内容。');
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function extractDocxText(buffer) {
  const entry = getZipEntry(buffer, DOCUMENT_XML_PATH);
  let xmlBytes;

  if (entry.compressionMethod === 0) {
    xmlBytes = entry.bytes;
  } else if (entry.compressionMethod === 8) {
    xmlBytes = await inflateRaw(entry.bytes);
  } else {
    throw new Error('当前 DOCX 压缩格式暂不支持。');
  }

  const xml = new TextDecoder().decode(xmlBytes);
  return extractTextFromDocumentXml(xml);
}
