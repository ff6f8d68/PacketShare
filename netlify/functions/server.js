// netlify-functions/file-handler.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const multipart = require('parse-multipart');

exports.handler = async function(event, context) {
  const { httpMethod, headers, body, isBase64Encoded } = event;

  if (httpMethod === 'POST') {
    const boundary = headers['content-type'].split('; ')[1].replace('boundary=', '');
    const parts = multipart.Parse(Buffer.from(body, 'base64'), boundary);

    if (parts[0].filename) {
      const filePath = path.join(__dirname, '../uploads', parts[0].filename);
      fs.writeFileSync(filePath, parts[0].data);

      const chunks = splitFile(filePath, 1024 * 1024); // 1MB chunks
      chunks.forEach((chunk, index) => {
        fs.writeFileSync(`${filePath}.part${index}`, chunk);
      });

      return {
        statusCode: 200,
        body: 'File uploaded and fragmented successfully.'
      };
    }
  } else if (httpMethod === 'GET') {
    const filePath = path.join(__dirname, '../uploads', event.path.slice(1));

    if (fs.existsSync(filePath)) {
      const chunks = [];
      let index = 0;
      while (fs.existsSync(`${filePath}.part${index}`)) {
        chunks.push(fs.readFileSync(`${filePath}.part${index}`));
        index++;
      }

      mergeChunks(chunks, filePath);

      const fileBuffer = fs.readFileSync(filePath);
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/octet-stream'
        },
        body: fileBuffer.toString('base64'),
        isBase64Encoded: true
      };
    } else {
      return {
        statusCode: 404,
        body: 'File not found.'
      };
    }
  }

  return {
    statusCode: 405,
    body: 'Method not allowed.'
  };
};

// Helper functions
const splitFile = (filePath, chunkSize) => {
  const stats = fs.statSync(filePath);
  const fileSize = stats.size;
  const chunks = [];
  const fileBuffer = fs.readFileSync(filePath);
  for (let i = 0; i < fileSize; i += chunkSize) {
    chunks.push(fileBuffer.slice(i, i + chunkSize));
  }
  return chunks;
};

const mergeChunks = (chunks, outputPath) => {
  const fileBuffer = Buffer.concat(chunks);
  fs.writeFileSync(outputPath, fileBuffer);
};
