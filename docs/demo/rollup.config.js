import progress from 'rollup-plugin-progress';
import filesize from 'rollup-plugin-filesize';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: '../../index.js',
  output: {
    file: 'index.js',
    format: 'esm'
  },
  plugins: [
    progress({
      clearLine: false
    }),
    nodeResolve(),
    filesize()
  ]
};
