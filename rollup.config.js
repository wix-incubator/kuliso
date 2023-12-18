import progress from 'rollup-plugin-progress';
import filesize from 'rollup-plugin-filesize';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: 'src/Pointer.js',
  output: {
    file: 'dist/index.cjs',
    format: 'cjs'
  },
  plugins: [
    progress({
      clearLine: false
    }),
    nodeResolve(),
    filesize()
  ]
};
