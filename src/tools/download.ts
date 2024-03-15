import * as https from 'https';

export async function download(options: string | URL | https.RequestOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Uint8Array[] = [];
        https.get(options, (response) => {
            response.on('data', (chunk: Uint8Array) => {
                chunks.push(chunk);
            });

            response.on('end', () => {
                resolve(Buffer.concat(chunks));
            });
        }).on('error', (error: Error) => {
            reject(error);
        });
    });
}
