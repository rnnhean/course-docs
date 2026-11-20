[00:00] Hello and welcome on this lecture we will start working on the gRPC for our notification systems but please note one thing very important here that whenever we the gRPC called we should be able to control the web socket server from in the gRPC systems which is mean one thing that we have a connection point
[00:29] that connect between the grbc and the socket server allow the grbc server to call the socket server and you will see how this should be or we will learn with each other how can we do something like that on this lecture and the next lecture so start by creating a symbol file call it main all right
[00:57] and this of course should be with package main which is the main package func main and then we can use mutex and web socket to use them within the grbc
[01:26] you'll see what I mean on a second first of all we can just say select we need to block main go routine to keep program running for this we can simply say select and keep it empty and then here
[01:55] we can start by define web socket and WS we can call it mute or mute x which will equal to sync mute x sense that we are simply want to synchronize or synchronize the jrb server
[02:24] with the web socket server okay after that we can create WS or web sockets make map of string pointers of web socket Web socket which web socket exactly we are looking for not this one
[02:54] node this one node yeah this one dot con okay we can hit save need to say go mod tidy all right this for run fiber for us
[03:22] then we can now here call the grbc server and the socket server and keep them both of them synchronized with each other all right now what we can do we can start by say create a new directory you can call it something like serve g
[03:51] or pc all right and then we can call create a new file call it service grpc.go okay i just keep this on okay say package service
[04:21] our server grbc stored by defining the type of the service we call all the grb server uh monitor import first this pp off real what we call this i just go to the mod copy this one
[04:50] paste it here realtime notification slash produce okay now this is unusable not usable but we're gonna use it all right now just define the server say type notification server which will be a struct
[05:20] okay now we can use this pp say unimplemented notification server also we need to define dws mu sync pointer of sync mutex
[05:49] all right next we can just say ws map of string pointer of web socket dot con
[06:18] this is capital C remember it's the same signature that we are defining here and in here we need to define the type of the notification
[06:45] Are we able to copy this from main? We just tried it by ourselves. You know what? I prefer to copy this from main, just in CD. Okay, we just close this anyway.
[07:12] I want to open this API here. Why can't we do this? Okay, I just closed this one. Try this one more time, say code. Okay, it looks like something is not right. Anyway, we need to go inside
[07:42] Models. Notification model. We need to open this here. Alright. It looks like that something is not right. I'll fix it. But anyway, we just write it by ourselves. It doesn't tell us why we can do this.
[08:08] We just try this one. I can just say type notification It will be a struct ID of string back text json underscore ID Okay, I just
[08:36] duplicate this multiple times after id we have details we already actually type it hud.id details i know that this is stable and we type it like this details
[09:04] on this one we didn't just have it like this we can keep it like this with small case okay after the details we have main UID main
[09:32] your ID and we have target ID target ID after that we have is redid
[09:59] here we have as reddit just R A D A D reddit as reddit I know that this is totally different from this
[10:26] but this is how we have this on the on the models ok, after that we will see how this will work anyway we have created at this one is created at but this one is time dot time
[10:56] okay finally we got the user which is type of user and the JSON of it is user okay for that we can just come up here say type user it is a struct name
[11:25] okay we need to copy something like this I just copy paste it here we got the name we got the avatar just
[11:54] fix this and fix this with capital n write or call or done with the struct now we need to create the server but first we need to overwrite the method that we call it here on the grpc remember on protos this is the method name
[12:23] to be able to run the jrvc server we need to say func s so it should be pointer of sorry pointer of notification server we want to have a method name with the same name ctx content contacts
[12:53] of contacts the request should be pointer of pp.notification.jrbc request okay the response can be pointer of empty
[13:20] dot empty note that this already get this directly which is the correct one empty dot empty and a rush
[13:48] great now what we can do we can have we can print this sending notification we just print it fmt printf sending notification to user percentess another percentess
[14:17] backslash and pass the request dot main uid no something is not right
[14:46] this is the correct thing need to hide save
[15:07] we just go back to real-time notification open up this one say go mod tidy okay
[15:36] yeah this is the correct name we have this ID it is actually X ID create it okay to just keep this after that request dot details for example okay that's cool
[16:00] after that we can send here send the notification to socket server and how actually you can do this we can use this s WS mutex sorry s dot
[16:28] Can we change this side a bit? We look like the other one, yes. MU by this way, okay. After that, we can just say S dot WS mere text dot lock D fear S dot WS.
[16:58] mutex unlock after that check f deconnexion is okay inside of this s tablios where the request dot main uid if this okay the notification
[17:25] now we need to create a notification first the id would be request.xid y this has been created with that name because we have an already id for each request it's created by the popup and this handle is
[17:53] this on the background handle the request itself, genre request itself after that we have main UID will be request main UID details note that this totally different but we can handle this for example this one is stable you know
[18:21] but this is how we can get this from the backend from the api we have it like this already so we are keeping the same names but we didn't have any problem since that we have key and values here after that the targetoid can say request targetoid is redid request is
[18:50] read it this is how we are writing this sorry request is read it if we go back where this one here it is why this makes an error
[19:18] Cannot use the variable of type 1 as a string construct. Okay, if we go back up here. Okay, it looks like that we created this correctly. This is pull-in. Maybe the error is here. Yes. Yeah.
[19:44] so after it is ready we got created that to convert it to and be able to transfer the data we need to say time dot eonix time dot eonix request created at seconds
[20:12] and just press zero user will be user object the name will be request user name request sorry request user
[20:39] name. I need to duplicate this for avatar. Alright, we're cool. More of a lot. Here we need to check error. The show goes to connection. Right. Json.
[21:08] notification and say f error not equal to nil on that case piece log printf error sending notification to web
[21:37] socket server percent V and pass this error all right for the third rat after all here we can just say return
[22:03] empty at empty and nil sorry not this one empty pointer of empty of course yeah we got some things not right but it it's okay
[22:29] that's cool finally now we can have a function for stored grpc server what you'll expect WS
[22:56] which would be a map of string pointer of this web socket connection and wsmu sorry wsmu mutex it should be a pointer of sync
[23:25] mutex and this card return just an error we want to add less error net dot listening on TCP protocol and here we can let this run on port 1888
[23:54] all right cool after that we can check if the error not equal to 0 on that case we need to return fmt error f failed to listen on port 18 a set of 8080 i just used 1890
[24:24] sorry 1890 okay 1890 okay on port percentage V error all right after that we can say grpc server will equal to grpc
[24:52] new server after that notification service will equal to enter of notification service or server actually sorry which will tick
[25:17] I will take the WS pointer of this WS WS mu which will be WS mu this one is not capital it is small
[25:39] after that we can say pp.register.notification.grpcserver and pass the grpcserver and notification service to exactly like we did before for that we can use goRoutine, goFunction, say here fError of grp
[26:07] c server serve on this less if they are not equal to new after that we can say log fatal f field to serve g rpc
[26:36] server error after all we can return nil we're all we just set save and now we are ready to do this operation but we need now to create
[27:05] rweb socket server note that we are able now to write json but if we test this side right now this will not work even let's just go back here what we will do here is to call jrpcserver okay by this way I can just say fr goes to
[27:34] server grbc serve sorry again serve grbc dot stored grbc server lasto edws and a pointer of this ws mutex error not equal to new on that case
[28:03] We want to say log.fatalf fail to start grpcserver and come up here say dr Actually this will not work because we are not having this WS work career
[28:31] or server yet, but we're gonna use the same MIOTEX and same web socket pointer so we can use both of them here inside the GRBC server we can have an access to the web socket itself so I think that's good for enough on this lecture I just complete the mission on X lecture
[28:59] you
