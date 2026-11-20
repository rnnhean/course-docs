[00:00] Hello and welcome my dear student. From this lecture we will start working on the real-time chat and on this lecture we will start building our application. First of all we need actually to start to update or may our branches so what we want to do is to go to the main branch you can just say get check out main and then say get pull to be updated
[00:29] of everything I already did this after that we need to create a new branch we can name it a real time chat so we can just say get-mp real time chat okay I already did this so it is exist so we can just say check out p okay now we are inside the new branch we can start work on that
[00:58] we can just go inside this one and start create a new folder we can name our folder real time chat all right now we need to start building our new server we just open up yeah thermal just say copy it all right now let's close this
[01:27] popups and we can can we start to admin let's just start by say go mod or go init and we can name this real time chat
[01:56] i think we need to say go mod okay we already created this we created the module all right after that we need to install fiber since that we are gonna use fiber just copy the command and paste that here
[02:24] wait until the installation is finished, while the installation is on, let's just start by saying main.go all right, let's just start up here by say package main all right and on this section actually we can simply try assemble a real-time or web socket connection
[02:53] and test it via postman i just go to the postman okay we just start to create this first and i think we didn't need to install anything uh go for a burrow up socket version 2 everything is already here but we'll discover actually whether we need to do this or not we can just sort by save on
[03:22] main and as you already know we need to send or having send the user ID or having our user ID via the connection so we just place that on the lecture and anyway we're going to use this so we can directly work on that
[03:47] first we can just say that we need to initialize our fiber app okay fiber v2 yeah next we need to allow the connections so we can just say app use course
[04:14] new course config we can just say allow credentials and pass through and then allow origin functions yep
[04:43] say func yes by this way origin string boolean we can simply return true okay this is not for the production it is just for debugging and testing etc all right now we want to start by re-register
[05:10] registering web socket route and update web socket handler and errors let's just ignore this first for now okay for that we can just store by say app get
[05:37] and here is the route we can simply say WS or WebSocket and the dynamic world is the OID after that we can just say WebSocket no we didn't need to use this one WebSocket not this one
[06:06] or this one it is gofiber web socket version 2 yep this one that we need to use okay after that we can just say .new and here we can just pass a function this function should have c
[06:35] of pointer of web socket connection or con okay after that we can just come up here and we can just get the id we can just say id
[07:05] is equal to c.perms.oid. all right, what after that? we can actually say fmt
[07:32] print this ID or we can just say c.writeMessage
[07:57] and now we can say web socket text message and here pass array of bytes or slice of bytes say welcome user and pass his id okay that's um symbol for enough
[08:23] I think it's a symbol for an off actually. Of course this will not be that simple. Anyway after we getting this we can just came up down here and say log.fatal and pass the app and let our app listen.
[08:53] on port let's just say port will be 8000 and on okay to clarify that we need to install this so we can just say go mod.id and enter yep wait until the installation is finished
[09:19] but actually we didn't need this web socket so we can just remove this one and what else we need to do okay I think we can save this one okay let's just say go more tidy once again okay we're cool
[09:47] now we need to start connect to our application first we need to run our application so go run main.go where our application is running hit on allow access and then open the postman web socket
[10:14] all right and to be able to run to be able to connect on that we should start with say WS double slash localhost 8000 and one and then slash
[10:42] WS since that the route that we write it over there we name it WS slash and here we can send the ID I just try to connect okay already connected note that we have a welcome message all right but this doesn't keep the connections right
[11:10] because we didn't have to make it keep receiving and sending messages but we stored this very all I think now we are on a good point we can now follow on and keep work on that from the next lecture so see you on the next lecture
[11:29] you
