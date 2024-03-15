import * as https from 'https';

export async function download(options: string | URL | https.RequestOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        let request = https.get(options);

        request.on('data', (chunk: Uint8Array) => {
            chunks.push(chunk);
        });

        request.on('end', () => {
            resolve(Buffer.concat(chunks));
        });

        request.on('error', (error: Error) => {
            reject(error);
        });
    });
}
