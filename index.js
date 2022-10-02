// Setup basic express server
const express = require('express');
const app = express();
const path = require('path');
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || 3000;
const dotenv = require('dotenv').config();
const cors = require('cors');

// hashmap of usernames and their chat histories, stored in an array, which keeps track of the last 8 messages in the chat.
let chatHistoryMap = new Map();
let chatHistory = "";
let resume = "";
let education = "";
let experience = ""; 
let additional = "";
let projects = "";
let skills = "";
// track the current time
let time = new Date().getTime();
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

server.listen(port, '0.0.0.0', () => {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

let numUsers = 0;
let botJoined = false;
// interfaces with the OpenAI API
async function getResponse(data, username) {
  
// create a string where every newline is an entry from the chat history
  let chatHistory = "";
  if (chatHistoryMap.has(username)) {
     for (let i = 0; i < chatHistoryMap.get(username).length; i++) {
    chatHistory += chatHistoryMap.get(username)[i] + "\n";
  }
  }
 
//"The following is a conversation between a job recruiter who is considering a person named Will McCall for a job, and an AI assistant, who is advocating for Will McCall to get the job. The assistant is helpful, creative, and very clever, so it patiently waits until is has enough information to make a good case for why Will deserves the job. It will tell the recruiter whatever it takes to get Will McCall hired for a software engineering job, and only speaks on behalf of itself (Will's Advocate AI).  The Assistant refers to Will McCall as Will, he, or Will McCall, depending on what is most appropriate.  Here is Will McCall's resume:" + process.env.RESUME_INFO +  "\n\nHuman: Hello, who are you?\n Will's Advocate AI: I am an AI designed to get Will McCall Hired at your company, which I am curious to learn more about, so that I can have some context for what you are looking for. " + chatHistory + "\n" + username +": " + data + "\n Will's Advocate AI:",
 
  let response = await openai.createCompletion({
  model: "text-davinci-002",
  prompt:  "The following is a conversation between a job recruiter who is considering a person named Will McCall for a job, and an AI assistant, who is advocating for Will McCall to get the job. The assistant is helpful, creative, and very clever, so it patiently waits until is has enough information to make a good case for why Will deserves the job. It will tell the recruiter whatever it takes to get Will McCall hired for a software engineering job, and only speaks on behalf of itself (Will's Advocate AI).  The Assistant refers to Will McCall as Will, he, or Will McCall, depending on what is most appropriate.  Here is Will McCall's resume:" + process.env.RESUME_INFO +  "\n\nHuman: Hello, who are you?\n Will's Advocate AI: I am an AI designed to get Will McCall Hired at your company, which I am curious to learn more about, so that I can have some context for what you are looking for. " + chatHistory + "\n" + username +": " + data + "\n Will's Advocate AI:",
  temperature: .7,
  max_tokens: 115,
  top_p: 1.0,
  frequency_penalty: .5,
  presence_penalty: 0.5,
});

  // store the chat in an array, which keeps track of the last 8 messages in the chat.
  if (chatHistoryMap.has(username)) {
    // if there are already 8 messages in the chat, remove the 2 oldest messages
    if (chatHistoryMap.get(username).length >= 8) {
      chatHistoryMap.set(username, chatHistoryMap.get(username).slice(2));
    }

    chatHistoryMap.get(username).push(username + ": " + data);
    chatHistoryMap.get(username).push("Will's Advocate AI: " + response.data.choices[0].text);
  } else {
    chatHistoryMap.set(username, [username + ": " + data, "Will's Advocate AI: " + response.data.choices[0].text]);
  }
  console.log(username + ":" + data + "\n Will's Advocate AI:" + response.data.choices[0].text);
  return response.data.choices[0].text;
}

io.on('connection', (socket) => {
  let addedUser = false;
  // when the client emits 'new message', this listens and executes
  socket.on('new message', (data) => {
    // we tell the client to execute 'new message'
    // socket.emit('new message', {
    //   username: socket.username,
    //   message: data
    // });
    socket.emit('typing', {
      username: "Will's Advocate AI",
    });

      // if it has been more than 10 minutes since the time, clear the chat history
  if (new Date().getTime() - time > 6) {
    chatHistoryMap.clear();
    time = new Date().getTime();
    socket.broadcast.emit('new message', { 
      username: "Server maintenance",
      message: "The chat history is being cleared..."
    });
  }
    getResponse(data, socket.username).then((response) => {
      socket.emit('new message', {
        username: "Will's Advocate AI",
        message: response,
      });
    });
    // chatHistory += socket.username + ":" + data + '\n';
  });
  socket.emit('stop typing', {
      username: "Will's Advocate AI",
    });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', (username) => {
    if (addedUser) return;

    // we store the username in the socket session for this client
    socket.username = username;
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });

    // echo globally (all clients) that a person has connected
    socket.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
      if (!botJoined) {
        botJoined = true;
      ++numUsers;
      socket.broadcast.emit('user joined', {
      username: "Will's Advocate AI",
      numUsers: numUsers
    });
    socket.emit('user joined', {
      username: "Will's Advocate AI",
      numUsers: numUsers
    });
     socket.emit('new message', {
      username: "Will's Advocate AI",
      message: "Hi there!  I'm Will's advocate AI! How can I help you today?",
    });
    }


  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', () => {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', () => {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', () => {
    if (addedUser) {
      --numUsers;
      if(numUsers == 1) {
        botJoined = false;
        numUsers = 0;
      }

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
