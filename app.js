var express = require('express')
var bodyParser = require('body-parser')
var mysql = require('mysql');
const b = require('based-blob')
global.atob = require("atob")
global.Blob = require('node-blob')
var app = express()

var connection = mysql.createConnection({
    host: 'localhost',
    user:'root',
    password:'password',
    database: 'sessions'
});

connection.connect();

var player_count = 1;
/*
connection.query('SELECT * FROM login', function(error,results,fields){
    if(error) throw error;
    for(var i = 0; i < results.length; i++){
        console.log('The solution is:', results[i])
    }
})*/



colors = [{color:'eb5243'},
                {color:'18e21a'},
                {color:'1628d5'}]




app.use(bodyParser.urlencoded({ extended: false }))

app.get('/', function (req,res){
    res.json({ username: 'Flavio' })
})

app.post('/hello', function(req,res){
    console.log(req.body.username)
    console.log(req.body.password)
    console.log(JSON.stringify(req.body))
    var username = req.body.username
    var password = req.body.password

    var query = connection.query('INSERT INTO login(username,password) VALUES(?,?)',[username,password], function(error,results,fields){
        if(error) throw error;
    })

})

app.post('/join', function(req,res){
    checkExistGameSession(function(err,results){
        if(results == 0){
            createSession()
        }else{

            checkPlayerCount(function(err, results){
                for(var i = 0; i < results.length; i++){
                    if(results[i].playercount < player_count){
                        //join this session
                        //create player
                        addPlayerToSession(results[i].id, req.body.username)

                        res.json({gamesessionid: results[i].id})
                    }else if(i+1 == results.length){
                        createSession()
                        addPlayerToSession(results[i].id, req.body.username)

                        res.json({gamesessionid: results[i].id})
                        
                    }
                }
            })
        }
    })
})

app.post('/wait', function(req, res){
    gameid = JSON.parse(req.body.gamesessionid)
    console.log('checking')
    checkSessionPlayerCount(gameid, function(err, results){
        stuff = JSON.stringify(results)
        stuff = JSON.parse(stuff)
        console.log(stuff[0].playercount)
        if(stuff[0].playercount == player_count+1){
            startSession(stuff[0].id)
            res.json({gamesessionready: true})
        }
    })
})


app.post('/startturn', function(req, res){
    //get a word and add it to the  gamesessionid first
    var data = JSON.parse(JSON.stringify(req.body))
    console.log('starting turn ')
    updateBlob(data.gamesessionid, data.bitmap)
    startTurnInfo(data.gamesessionid, function(err, results){
        sending = JSON.stringify(results);
        res.json({'sessioninfo':results})
    })
})

app.post('/syncturn', function(req,res){
    var data = JSON.parse(JSON.stringify(req.body))
    console.log('Syncing turn')
    console.log(data.gamesessionid)
    console.log(data.username)

    setPlayerReady(data.gamesessionid, data.username)
    checkPlayerReady(data.gamesessionid, function(error, results){
        if(error) throw error;
        data = JSON.parse(JSON.stringify(results))
        console.log(data)
        check = 1;
        for(var i = 0; i < data.length; i++){
            console.log(data[i].playerready == 0)
            console.log(data[i].playerready == null)
            if(data[i].playerready == 0)
                check = 0
            if(data[i].playerready == null)
                check = 0
        }
        //console.log(check)
        if(check == 1){
            res.json({'turnready': 'true'})
        }else{
            res.json({'turnready': 'false'})
        }
    })
})

app.post('/uploadingbitmap', function(req,res){
    var data = JSON.parse(JSON.stringify(req.body))
    console.log('uploading')
    console.log(data.gamesessionid)
    updateBlob(data.gamesessionid, data.bitmap)
    res.json({'success':'true'})

})

app.post('/downloadbitmap', function(req,res){
    var data = JSON.parse(JSON.stringify(req.body))
    console.log('downloading')
    console.log(data.gamesessionid)
    getBitmapBlob(data.gamesessionid, function(err, results){
        res.json({'bitdata':results})
    })
})

app.post('/uploadchat', function(req, res){
    var data = JSON.parse(JSON.stringify(req.body));
    getCurrWord(data.gamesessionid, function(err, results){
        word = JSON.parse(JSON.stringify(results))
        serverword = word[0].currword
        appword = data.message
        if(serverword.toLowerCase() == appword.toLowerCase()){
            addChatMessage(data.gamesessionid, data.username, '++++++++++')
            checkScoreToGive(data.gamesessionid, function(err, results){
                scoreData = results
            
                if(scoreData == 0){
                    addScore(data.gamesessionid, data.username, '1')
                }
                else{
                    addScore(data.gamesessionid, data.username, (scoreData[scoreData.length-1].score+1))
                }
            })
            res.json({'guess':'true'})
        }else{
            addChatMessage(data.gamesessionid, data.username, data.message)
        }
    })
    console.log(data)
    //check if word is correct and give score
})

app.post('/downloadchat', function(req, res){
    var data = JSON.parse(JSON.stringify(req.body))
    downloadChat(data.gamesessionid, function(err, results){
        res.json({'chatdata': results})
    })
})

app.post('/runthiswhileplaying', function(req,res){
    
})

function checkScoreToGive(gameId, callback){
    connection.query('SELECT score.score FROM score WHERE gamesessionid = ?',[gameId], function(error, results, fields){
        callback(null, results)
    })
}

function addScore(gameId, username, score){
    connection.query('INSERT INTO score(gamesessionid, uname, score) VALUES(?,?,?)',[gameId, username, score], function(error,results, fields){

    })
}

function getCurrWord(gameId, callback){
    connection.query('SELECT gamesession.currword FROM gamesession WHERE id = ?',[gameId], function(error,results, fields){
        callback(null, results)
    })
}

function downloadChat(gameId, callback){
    connection.query('SELECT * FROM chat WHERE gamesessionid = ?',[gameId], function(error,results, fields){
        callback(null, results)
    })
}

function addChatMessage(gameId, username, message){
    connection.query('INSERT INTO chat (gamesessionid, uname, chattext) VALUES(?,?,?)', [gameId, username,message], function(error, results,fields){

    })
}
function checkPlayerReady(gameId, callback){
    console.log(gameId)
    connection.query('SELECT player.playerready FROM player WHERE gamesessionid = ?', [gameId], function(error,results, fields){
        callback(null, results)
    })
}

function setPlayerReady(gameId, username){
    connection.query('UPDATE player SET playerready = ? WHERE gamesessionid = ? AND uname = ?',[1, gameId, username], function(error, results, fields){

    })
}

function getBitmapBlob(gameid, callback){
    connection.query('SELECT gamesession.bitmap FROM gamesession WHERE id = ?',[gameid], function(error, results, fields){
        callback(null, results)
    })
}
function updateBlob(gameid, bitmap){
    connection.query('UPDATE gamesession SET bitmap = ? WHERE id = ?',[bitmap, gameid], function(error,results,fields){
    })
}



function startTurnInfo(gamesessionid, callback){
    connection.query('SELECT gamesession.currplayer, gamesession.currword, gamesession.currtime, player.id, player.uname, player.color, player.played, player.score FROM gamesession LEFT JOIN player ON gamesession.id = player.gamesessionid WHERE gamesession.id = ? UNION SELECT gamesession.currplayer, gamesession.currword, gamesession.currtime, player.id, player.uname, player.color, player.played, player.score FROM gamesession RIGHT JOIN player ON gamesession.id = player.gamesessionid WHERE gamesession.id = ?',[gamesessionid, gamesessionid], function(error,results,fields){
        if(error) throw error;
        callback(null, results)
    })
}

function checkSessionPlayerCount(gamesessionid,callback){
    connection.query('SELECT * FROM gamesession WHERE id = ?',[gamesessionid.gamesessionid], function(error,results,fields){
        if(error) throw error;
        callback(null, results)
    })
}

function startSession(gameid){
    console.log('starting')
    console.log(gameid)

    getPlayerIds(gameid,function(err, results){
        ids = JSON.stringify(results);
        ids = JSON.parse(ids);
        for(var i = 1; i < player_count+2; i++){

            connection.query('UPDATE player SET color = ?, playerready = ?   WHERE gamesessionid = ? AND id = ?',[colors[i-1].color,gameid,0,ids[i-1].id], function(error,results,fields){
            })
        }
        connection.query('UPDATE gamesession SET currplayer = ?, currtime = ADDTIME(now(), \'00:04:00\'), seassionfinish = ?, currword = ? WHERE id = ?',[ids[0].uname,0,'Poop',gameid], function(error,results,fields){
        })
    })
}

function getPlayerIds(gameid, callback){
    connection.query('SELECT * FROM player WHERE gamesessionid = ?',gameid, function(error,results,fields){
        callback(null, results)
    })
}

function checkExistGameSession(callback){
    connection.query('SELECT * FROM gamesession', function(error,results,fields){
        if(error) throw error;
        callback(null, results)
    })
}

function checkPlayerCount(callback){
    connection.query('SELECT id, playercount FROM gamesession', function(error,results,fields){
        if(error) throw error;
        callback(null, results)
    })
}

//creates a new session
function createSession(){
    console.log('creating session')
    connection.query('INSERT INTO gamesession(playercount) VALUES (0)', function(error,results,fields){
    })
}

function addPlayerToSession(gamesessionid, username){
    connection.query('UPDATE gamesession SET playercount = playercount + 1 WHERE id = ?',gamesessionid, function(error,results,fields){
    })
    connection.query('INSERT INTO player(gamesessionid, uname, played, score) VALUES (?,?,?, ?)',[gamesessionid, username, 0, 0], function(error,results,fields){
    })

}

function updateSessionStartData(){

}

app.listen(3000)
