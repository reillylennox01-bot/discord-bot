import express from 'express';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.get('/', (_req, res) => res.send('Bot running'));

app.listen(port, () => console.log(`Web server listening on ${port}`));
