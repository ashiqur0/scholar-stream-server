const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Hello from scholar stream server');
});

app.listen(port, (req, res) => {
    console.log(`server is running at http://localhost:${port}`);
})