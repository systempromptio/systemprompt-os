import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(3002, () => {
  console.log('Test server listening on port 3002');
});