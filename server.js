const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cheerio = require('cheerio');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = 3000;

// 원격 서버의 URL
const REMOTE_SERVER_URL = 'https://sartopo.com/map.html';

// 정적 파일 제공
app.use(express.static(path.join(__dirname, 'static')));

// JSON 바디 파싱을 위한 미들웨어
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 클라이언트에게 HTML 페이지를 전달하는 라우트
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// HTML 수정 함수
const modifyHTML = (html, baseUrl) => {
    const $ = cheerio.load(html);
   
    $('link[href], script[src], img[src]').each((i, element) => {
        const attr = element.tagName === 'link' ? 'href' : 'src';
        const url = $(element).attr(attr);

        if (url && !url.startsWith('http')) { // 상대 경로가 아닌 경우 모두 수정
            $(element).attr(attr, `${baseUrl}${url}`);
        }
    });

    // Replace all occurrences of '/static/js' with 'https://caltopo.com/static/js' in script src attributes
    $('script').each((i, element) => {
        const src = $(element).attr('src');
        if (src && src.startsWith('/static/js')) {
            $(element).attr('src', src.replace('/static/js', 'https://caltopo.com/static/js'));
        }
    });

    return $.html();
};

// Proxy 서버 미들웨어
// Proxy 서버 미들웨어
app.use('/proxy', createProxyMiddleware({
    target: REMOTE_SERVER_URL,
    changeOrigin: true,
    pathRewrite: {
        '^/proxy': '/', // 프록시 경로 제거
        
    },
    onProxyRes: (proxyRes, req, res) => {
        let body = Buffer.from('');
        proxyRes.on('data', (chunk) => {
            body = Buffer.concat([body, chunk]);
        });
        proxyRes.on('end', () => {

            const modifiedHTML = modifyHTML(body.toString(), REMOTE_SERVER_URL);
            res.send(modifiedHTML);
        });
    },
    onProxyReq: (proxyReq, req, res) => {
        // 요청 헤더 수정
        proxyReq.setHeader('Cookie', req.headers.cookie);
        proxyReq.setHeader('Referer', req.headers.referer);
        proxyReq.setHeader('Host', 'sartopo.com');
    },
}));

// 서버 시작
app.listen(PORT, () => {
    console.log(`Proxy server is running on port ${PORT}`);
});
