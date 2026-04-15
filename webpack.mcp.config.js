const path = require('path');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');

module.exports = {
    target: 'node',
    mode: 'production',
    entry: './src/mcp/server.ts',
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'mcp-server.js',
        libraryTarget: 'commonjs2'
    },
    externals: {
        vscode: 'commonjs vscode'
    },
    resolve: {
        extensions: ['.ts', '.js'],
        plugins: [
            new TsconfigPathsPlugin({
                configFile: './tsconfig.json'
            })
        ]
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        configFile: 'tsconfig.json'
                    }
                }
            }
        ]
    },
    node: {
        __dirname: false,
        __filename: false
    }
};
