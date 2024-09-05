const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multipart = require('parse-multipart');

// Directory where files will be uploaded
const UPLOAD_DIR = path.join(__dirname, '../uploads');

// Ensure the upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

// Helper function to hash the file name using SHA-256
const hashFileName = (fileName) => {
    return crypto.createHash('sha256').update(fileName).digest('hex');
};

exports.handler = async function (event, context) {
    const { httpMethod, headers, body, queryStringParameters } = event;

    if (httpMethod === 'POST') {
        // Parse multipart form data to get the file
        const boundary = headers['content-type'].split('; ')[1].replace('boundary=', '');
        const bodyBuffer = Buffer.from(body, 'base64');
        const parts = multipart.Parse(bodyBuffer, boundary);

        if (parts[0] && parts[0].filename) {
            // Save file to the upload directory
            const originalFileName = parts[0].filename;
            const hashedFileName = hashFileName(originalFileName);
            const filePath = path.join(UPLOAD_DIR, hashedFileName);

            // Write the file data to the server
            fs.writeFileSync(filePath, parts[0].data);

            return {
                statusCode: 200,
                body: JSON.stringify({
                    message: 'File uploaded successfully',
                    fileName: originalFileName,
                    downloadKey: hashedFileName
                })
            };
        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'No file uploaded' })
            };
        }
    } else if (httpMethod === 'GET') {
        // Retrieve the download key from the query string
        const { downloadkey } = queryStringParameters;

        if (downloadkey) {
            const filePath = path.join(UPLOAD_DIR, downloadkey);

            if (fs.existsSync(filePath)) {
                const fileData = fs.readFileSync(filePath);
                return {
                    statusCode: 200,
                    headers: {
                        'Content-Type': 'application/octet-stream',
                        'Content-Disposition': `attachment; filename=${downloadkey}`
                    },
                    body: fileData.toString('base64'),
                    isBase64Encoded: true
                };
            } else {
                return {
                    statusCode: 404,
                    body: JSON.stringify({ message: 'File not found' })
                };
            }
        } else {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: 'Download key is missing' })
            };
        }
    }

    return {
        statusCode: 405,
        body: 'Method Not Allowed'
    };
};
