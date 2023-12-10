import progress from 'rollup-plugin-progress';
import filesize from 'rollup-plugin-filesize';

export default {
  input: 'src/Kuliso.js',
  output: {
    file: 'dist/index.cjs',
    format: 'cjs'
  },
  plugins: [
    progress({
      clearLine: false
    }),
    filesize()
  ]
};