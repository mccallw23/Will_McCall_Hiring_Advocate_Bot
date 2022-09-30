// Setup basic express server
const express = require('express');
const app = express();
const path = require('path');
const server = require('http').createServer(app);
const io = require('socket.io')(server);
const port = process.env.PORT || '0.0.0.0';
const dotenv = require('dotenv').config();

let chatHistory = "";
let resume = "";
let education = "";
let experience = ""; 
let additional = "";
let projects = "";
let skills = "";
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

server.listen(port, '0,0,0,0', () => {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(path.join(__dirname, 'public')));

// Chatroom

let numUsers = 0;

// interfaces with the OpenAI API
async function getResponse(data, username) {
  // gets the chat response from the chatbot based on a user inpu
  //console.log("awaiting response"); 

  
  //console.log("resume: " + resume);
  let response = await openai.createCompletion({
  model: "text-davinci-002",
  prompt: "The following is a conversation between a job recruiter who is considering a person named Will McCall for a job, and an AI assistant, who is advocating for Will McCall to get the job. The assistant is helpful, creative, and very clever, so it patiently waits until is has enough information to make a good case for why Will deserves the job. It will tell the recruiter whatever it takes to get Will McCall hired for a software engineering job, and only speaks on behalf of itself (Will's Advocate AI).  The Assistant refers to Will McCall as Will, he, or Will McCall, depending on what is most appropriate.  Here is Will McCall's resume:" + process.env.RESUME_INFO +  "\n\nHuman: Hello, who are you?\n Will's Advocate AI: I am an AI designed to get Will McCall Hired at your company, which I am curious to learn more about, so that I can have some context for what you are looking for. " + chatHistory + "\n" + username +": " + data + "\n Will's Advocate AI:",
  temperature: .6,
  max_tokens: 150,
  top_p: 1.0,
  frequency_penalty: .5,
  presence_penalty: 0.4,
});
  //console.log("response received");
  chatHistory += "AI: " + response.data.choices[0].text + '\n';
  //console.log(chatHistory);
  return response.data.choices[0].text;
}

io.on('connection', (socket) => {
  let addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', (data) => {
    // we tell the client to execute 'new message'
    socket.broadcast.emit('new message', {
      username: socket.username,
      message: data
    });
    // get the response from the chatbot
    getResponse(data, socket.username).then((response) => {
      socket.emit('new message', {
        username: "Will's Advocate AI:",
        message: response,
      });
    });
    chatHistory += socket.username + ":" + data + '\n';
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
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
    });
      if (numUsers == 1){
      ++numUsers;
      socket.broadcast.emit('AI chatbot joined', {
      username: socket.username,
      numUsers: numUsers
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

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
