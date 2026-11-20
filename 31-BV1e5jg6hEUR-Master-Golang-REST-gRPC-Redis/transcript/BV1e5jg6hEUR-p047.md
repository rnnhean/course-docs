[00:00] hello and welcome on this lecture we will start create the realtime web socket server and we will gonna use it we're gonna use the total application first we need to fix this file name it doesn't make any difference but you just fix it next we need to create a new folder call it realtime
[00:29] which will represent a package we can create a file call it notify realtimews.go okay now I just define a package other name package realtime okay
[00:57] and as a matter of fact we didn't need to have this or this we can just copy the notification types from here just paste them here head save right of course we can have models file here and put that on it
[01:21] you can do this if you want but i can also leave it as it is all right now i'm just identifying the function of stored web socket server which will have parameter where ws map of string
[01:50] finder of web socket yeah web socket go go fiber web socket version 2 actually not not this one that we are looking for this is not how we are looking for we are not using this
[02:16] go fiber go fiber hope socket version 2 we are using this one ok after that we need to go back here
[02:45] say.con.ws.mu.mp pointer of sync.mu.txt all right uh after that we need to create a fiber yeah fiber version 2 new
[03:14] and say app use course new course config allow credential true
[03:43] allow origins function and pass the function with the same signature and simply return true all right okay down here we can just store to make this
[04:08] app.gut slash ws slash this part should be user ID web socket sorry web web socket new function web socket connection exactly
[04:35] and here we can say user id or equal to c to prams user id we can print this we can just say fmt printf user pointer s connected backslash n
[05:04] user id After that we want to store the web socket connection Handling and lesson for incoming notification from gRBC Say here store the WS connection we can just say WS We'll text lock After that
[05:33] dws with this user id equal to this c and then we can say ws mutex we need to unlock it to allow this jrbc to use it now we need to handle
[06:01] this connection can set the fear function need to call it and here we can see fmt printf user % s this connected backslash
[06:30] After that we need to remove the web socket connection so we can just say WS mute lock delete the WS and user ID After that WS mute X
[07:00] unlock this after all cc.close sorry c.close great after all we need to come up here lesson for incoming notification from grpc shear
[07:28] we can just make an infinity for loop and say war notification data will be a notification check the error of c.read.json
[07:55] pointer of this notification data after all say error if not equal to nia on the case log.rentf error reading notification data from WS
[08:24] here we need to add %v as the error and after all we can say break after that we need to forward the notification data to the client so you can just now after we get the message we can just say c.write.json
[08:52] notification data so what happened here that we are reading the notification.coming from the grbc server which is happened when we call it here on the connection after that we forwarded to the user okay so now how can this actually
[09:17] if you note this that we are specifying the WID web socket connection to the specific user ID so by this way we are focusing on the user ID meaning if user one got a notification this will not get any pass anything to user number two or three or whatever even if they are connected
[09:40] all right well we can say right now that our app is ready and we can test it so they just test it real-time notification we can just say go more tidy okay go run main.go yeah allow this
[10:09] did we add any kind of logging i didn't pass any kind of logging but this will not work actually because we didn't yeah i think we need to close this we didn't call this yet on main on main files so what we want to do
[10:38] is to come up here, make go routine, say go realtime.store socket server ws.store the same ws mutex for mute. Head save.
[11:03] head, go, run, main.go, allow the access or you didn't print anything here. This is bad actually. We just go up here. We didn't print anything here or here on starting the services.
[11:26] but anyway we can now use it we can go open up the postman okay remember that you need to have two things first is web socket connection into port 18
[11:55] all right it will be web socket yeah it will be nearly the same thing so I can directly head on connect note 18 port 1890 head connect why this doesn't work the web socket
[12:23] This is the GRBC, sorry. The real time up socket is running on the front. This is the start for socket. We didn't start it yet. We forgot to listen on it, so this will not work, obviously.
[12:49] we need to come up here we say look fatal yeah fatal app listing on port let's just make it 80 80 80 let's save run this once again
[13:17] right hit allow access we have failed to listen listen import, missing port in address and this exit yes because that's because we need to add column here run this once again hit allow access now
[13:45] fiber running on this port if we now going back to the postman change this to 80808080 and had connect this connected successfully do we need this or this or this nope
[14:12] we need to add now new grpc we need to import the file go outside here, back on, the realtime notification, proto, notification to proto, import this one
[14:38] yes go back to the message we can select the message which is send GRBZ notification
[14:57] what was the we're running this on 1890 kind of a copy best dot here
[15:21] use an example the ID should be this one forget about the ID okay the ID can be anything but the target ID should be this one now if we
[15:49] head on invoke just give us this but doesn't update us ok sending to user C the other one isn't here ok it look like that this is kind of work but not working at the same time
[16:16] why maybe because of this ID I don't think so just copy this dot here say invoke this will send again it will not receive it here just go back and look up at this okay how we can define this one
[16:42] we are defined via mainuid so this is mean.org app nearly works fine but the idea here that we can use a new one okay and go back copy this id and look for mainuid paste.here and hit on invoke
[17:12] and go back here as you can see this is what we got because this depends on the web socket with request main user ID look for the target ID which is correct we didn't look for my target ID target ID is related if you remember to the place that our user will click on it
[17:38] such as the user profile if he start following him or the post if he start like or comment on it okay what we want to do right now is to look up for users to just copy this one or just do it we need to have another one nope
[18:06] we need to ok just close this ok we need new web socket copy this one and press start here ok first we need to know what happened if we hit on disconnect we need to clear up this we have user is disconnected great now we just
[18:35] copy this one paste that here already did this and now remember that this user that this ID here is the user ID here okay all we want to do right now is to copy this ID going back there head paste now we want to connect here
[19:04] connect here and recent this notification once again hit invoke go back as you can see we expected that here but here we didn't have nothing since that already defined it if we copy this change now the main user ID to this one on this one we will see the incoming
[19:31] notification just hit on invoke as you can see this is all we have just hit that once again we have it again and here we do have only one notification all this means on saying that everything is okay everything is cool on the next lecture we're gonna use this notification inside API whenever user start whenever we
[19:59] try to create a new notification record this means that we need to notify the user about this notification all right remember what for example if the user is disconnected just disconnect both of them and at the same time try to invoke this will not make any problem
[20:23] it will just work, it will not break the application or anything like that, hit invoke it will just try to send it and if it already connected it will he will just receive it if it not this will not break the app or anything like that it just is this hit connect connect going back invoke go back
[20:51] here from here as you can see we receive it again so everything look great let just now move on to the next lecture and start using
[21:01] on EPO.
