const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const cheerio = require('cheerio');
const cors = require('cors'); // cors 모듈 추가
const path = require('path');
const app = express();
const PORT = 3000;
const querystring = require('querystring');
const https = require('https');


app.use(cors());
// 원격 서버의 URL
const REMOTE_SERVER_URL = 'https://sartopo.com/map.html';
const REMOTE_SERVER = 'https://sartopo.com';



// JSON 바디 파싱을 위한 미들웨어
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 클라이언트에게 HTML 페이지를 전달하는 라우트
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});



const modifyHTML = (html, baseUrl) => {
    const $ = cheerio.load(html);
     
 
    $('link[href], script[src], img[src]').each((i, element) => {
        const attr = element.tagName === 'link' ? 'href' : 'src';
        const url = $(element).attr(attr);
       
        if (url && !url.startsWith('http')) { // 상대 경로가 아닌 경우 모두 수정
            $(element).attr(attr, `${baseUrl}${url}`);
        }
        if(url.startsWith('/static/js/')){
             $(element).attr(attr, `http://localhost:3000${url}`);

        }else{

           $(element).attr(attr, `https://sartopo.com${url}`);
        }
    });
    
        
    //console.log($.html());
    return $.html();
};
// JavaScript 응답을 수정하는 함수
function modifyJS(js, baseURL) {
    
    // Replace "/sideload" URLs
    js = js.replace(/(['"])\/sideload([^'"]*?)(['"])/g, (match, p1, p2, p3) => {
        if (!p2.startsWith('http')) {
            return p1 + baseURL + '/sideload' + p2 + p3;
        }
        return match;
    });

    // Replace "/static/images" URLs
    js = js.replace(/(['"])\/static\/images([^'"]*?)(['"])/g, (match, p1, p2, p3) => {
        if (!p2.startsWith('http')) {
            return p1 + "http://sartopo.com/static/images" + p2 + p3;
        }
        return match;
    });

   // Replace width: 100% with width: 70% if found in the page_main element
    js = js.replace(/(<div\s+id="page_main"\s+style="[^"]*?\bwidth:\s*?)100%(;[^"]*?"\s*>)/g, '$180%$2');

     // Replace "/account/oidclogin" URLs
    js = js.replace(/(['"])\/account\/oidclogin(['"])/g, (match, p1, p2) => {
        return p1 + "https://sartopo.com/account/oidclogin" + p2;
    });

    return js;
}
function modicookie(js, baseURL) {
    
    // Replace "/sideload" URLs
    return js.replace(/https:\/\/caltopo\.com/g, 'http://localhost:3000');
    

}
function downloadAndSendFile(req, res) {
    const requestedFile = req.url.slice(16); // /static/images/ 이후의 파일 경로
   
    // 원격 서버의 파일 URL
    const remoteFileUrl = 'https://sartopo.com/static/images/' + requestedFile;
   
    // HTTP GET 요청 보내기
    https.get(remoteFileUrl, (response) => {
        let fileData = '';

        // 데이터 수신 이벤트 핸들러
        response.on('data', (chunk) => {
            fileData += chunk;
        });

        // 데이터 수신 완료 이벤트 핸들러
        response.on('end', () => {
            // 클라이언트에게 파일 전송
            res.setHeader('Content-Type', 'application/octet-stream');
            res.send(fileData);
        });
    }).on('error', (error) => {
        console.error('Error downloading file:', error);
        res.status(500).send('Internal Server Error');
    });
}

// GET 요청에 대한 핸들러 설정
app.get('/static/images/*', (req, res) => {
    downloadAndSendFile(req, res);
});


const EXTERNAL_SERVER_URL = 'https://sartopo.com/sideload/constants.json';

// 데이터를 가져와서 전달하는 라우터
app.get('/sideload/constants.json', async (req, res) => {
    try {
        // 요청 파라미터에서 ts 값을 가져옴
        const ts = req.query.ts;
        
        // 외부 서버로 요청을 보냄
        const response = await axios.get(`${EXTERNAL_SERVER_URL}?ts=${ts}`);
        
        // 응답 데이터를 클라이언트에게 전달
        res.setHeader('Content-Type', 'application/json');
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Internal Server Error');
    }
});
// Route to get account details by ID
app.get('/sideload/account/:account_id.json', (req, res) => {
    const accountId = parseInt(req.params.account_id);
    const account = accounts.find(acc => acc.id === accountId);

    if (account) {
        res.json(account);
    } else {
        res.status(404).json({ error: 'Account not found' });
    }
});
app.get('/static/js/cookie-controls-1.js', async (req, res) => {
    try {
        // 외부 URL에서 파일을 가져옵니다.
        const response = await axios.get('https://sartopo.com/static/js/cookie-controls-1.js');
        
        // 가져온 파일을 클라이언트에게 반환합니다.

        // 캐싱 방지 헤더 설정
        res.set('Cache-Control', 'no-store');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.set('Content-Type', 'application/javascript');
        
        const modifiedJS = modicookie(response.data, 'http://localhost:3000');
      
       
        console.log(modifiedJS);
        res.setHeader('Content-Type', 'text/html');
        res.send(modifiedJS); // HTML 응답 전송
       
    } catch (error) {
        console.error('Error fetching file:', error);
        res.status(500).send('Internal Server Error');
    }
});
const EXTERNAL_SERVER_URL2 = 'https://sartopo.com/api/v0/userdata';
app.post('/api/v0/userdata', async (req, res) => {
    try {
        const requestData = req.body; // 클라이언트로부터 받은 데이터
        // JSON 데이터를 "json=" 스타일로 인코딩
       
        const encodedData = querystring.stringify(requestData);

        // 인코딩된 데이터를 클라이언트에게 전송
        res.setHeader('Content-Type', 'application/json');
    
      
        // sartopo.com 서버로 전달할 요청 정보 설정
        const requestOptions = {
            method: 'POST',
            url: EXTERNAL_SERVER_URL2,
            data: encodedData,
        };

        // sartopo.com 서버로 요청 보내기
        const response = await axios(requestOptions);
        const jsonResponse = JSON.stringify(response.data);
        res.json(jsonResponse);

    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Internal Server Error');
    }
});

// app.post('/account/oidclogin', async (req, res) => {
//     try {
//         const requestData = req.body; // 클라이언트로부터 받은 데이터
//         // JSON 데이터를 "json=" 스타일로 인코딩
       
//         //console.log(requestData);

//         // 인코딩된 데이터를 클라이언트에게 전송
//         res.setHeader('Content-Type', 'application/json');
    
      
//         // // sartopo.com 서버로 전달할 요청 정보 설정
//         const requestOptions = {
//             domain: requestData.domain,
//             url: requestData.url.replace('http://localhost:3000/proxy', 'https://sartopo.com/map.html'),
//             clientstate: requestData.clientstate,
//             signup: requestData.signup,
//         };
        
//         const encodedData = querystring.stringify(requestOptions);
//         //console.log(encodedData);
//         const request = {
//             method: 'POST',
//             url: 'https://sartopo.com/account/oidclogin',
//             data: encodedData,
//         };

//         const response = await axios(request);


//         const modifiedJS = modifyHTML(response.data, 'https://sartopo.com');
      
       
//         console.log(modifiedJS);
//         res.setHeader('Content-Type', 'text/html');
//         res.send(modifiedJS); // HTML 응답 전송

//     } catch (error) {
//         console.error('Error fetching data:', error);
//         res.status(500).send('Internal Server Error');
//     }
// });
app.get('/proxy', async (req, res) => {
    try {
        const { method, url, headers, body } = req;

        // 원격 서버로 전달할 요청 정보 설정
        const headersartopo = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'ko,en-US;q=0.9,en;q=0.8',
            'Connection': 'keep-alive',
            'Cookie': '_ssid=J381302BPLNM; _pk_id.7.62df=bd32a4363f567f0a.1715185302.; JSESSIONID=5104113B94CB25386F2E6A1786119424; _pk_ses.7.62df=1',
            'Host': 'sartopo.com',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'sec-ch-ua': '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Expires': '0'
        };
        const requestOptions = {
            method,
            url: REMOTE_SERVER_URL + url.replace('/proxy', ''), // 프록시 경로 제거
            headers: {
                headersartopo,
                host: 'sartopo.com',
            },
            data: body,
        };
       
        // 원격 서버에 요청 보내기
        const response = await axios(requestOptions);
      
        if (response.headers['content-type']) {
            if (response.headers['content-type'].includes('text/html')) {

                
                const modifiedHTML = modifyHTML(response.data, REMOTE_SERVER_URL);
              
                const chatHTML = `
                   <div style="float: right;width:20%;height: 105%";display:flex;>
                        <h2 style="text-align: center; font-size: 12px; background-color: #4CAF50">Chat</h2>
                        <div id="chat-box" style="border: 1px solid #ccc; height: 80%;border-radius: 5px; padding: 10px; background-color: #f9f9f9;">
                            
                        </div>
                        <ul id="messages" style="list-style-type: none; padding: 0; margin: 0;"></ul>
                        <form id="message-form" style="margin-top: 10px;">
                            <input type="text" id="message-input" autocomplete="off" style="width: calc(100% - 90px); padding: 5px; border: 1px solid #ccc; border-radius: 3px 0 0 3px; float: left; margin-right: 5px;">
                            <button style="width: 70px; padding: 5px; border: none; background-color: #4CAF50; color: white; border-radius: 0 3px 3px 0; float: left;">Send</button>
                        </form>


                    </div>

                `;

                
                // Modify HTML with chat container CSS and HTML
                let finalHTML = modifiedHTML + chatHTML;
                

                
                
                // 수정된 HTML을 클라이언트로 전송
                res.send(finalHTML);
                
              
               
            } else if (response.headers['content-type'].includes('application/javascript')) {
                const modifiedJS = modifyJS(response.data, REMOTE_SERVER_URL);
                res.setHeader('Content-Type', 'application/javascript');
                res.send(modifiedJS);
            } else {
                res.send(response.data);
                
            }
        } else {
            res.send(response.data);
        }
    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).send('Internal Server Error');
    } 
    
});

// 특정 경로의 JS 파일을 수정하여 전달하는 미들웨어
app.get('/static/js/main.js', async (req, res) => {

    try{

        const { method, url, headers, body } = req;

        const headers2 = {
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br, zstd",
            "Accept-Language": "ko,en-US;q=0.9,en;q=0.8",
            "Connection": "keep-alive",
            "Cookie": "_ssid=J381302BPLNM; _pk_id.7.62df=bd32a4363f567f0a.1715185302.; JSESSIONID=5104113B94CB25386F2E6A1786119424; _pk_ses.7.62df=1",
            "Host": "caltopo.com",
            "Referer": "https://sartopo.com/map.html",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
            "X-Requested-With": "XMLHttpRequest",
            "sec-ch-ua": "\"Google Chrome\";v=\"125\", \"Chromium\";v=\"125\", \"Not.A/Brand\";v=\"24\"",
            "sec-ch-ua-mobile": "?0",
            "sec-ch-ua-platform": "\"Windows\"",
        };
        
        

        const requestOptions = {
            method,
            url: REMOTE_SERVER+ '/static/js/main.js',
            headers: {
                headers2,
                host: 'sartopo.com',
                
            },
            data: body,
        };

        // 원격 서버에 요청 보내기
        const response = await axios(requestOptions,  withCredentials=true);


        const modifiedJS = modifyJS(response.data, 'http://localhost:3000');
      
        // 캐싱 방지 헤더 설정
        res.set('Cache-Control', 'no-store');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.setHeader('Content-Type', 'application/javascript');
        res.send(modifiedJS);
    } catch (error) {
        console.error('Proxy JS Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`Proxy server is running on port ${PORT}`);
});
