[00:00] hello and welcome after we done creating our backend system for real time for modification real time chat use the jrbc etc now it's time to start use this on our front end very well and we will start actually work it on the modification first of all we need to go to the main to the API
[00:27] and we need to start from this but for that we can just say go build go run build sorry it is just go build and we need to build file for this allow us execution file for this which will allow us
[00:56] run it easily and we can do the same here for notification go Peld and I think we can do the same here for the real-time chat as well and after that let's just run the API
[01:21] note that the API will create a file called server with the same name of the package itself and for that you can just say dot slash server or backslash server on API okay this is one and here for real-time notification
[01:47] not max slash realtime okay realtime notification yes.exe right now we are ready we can go on frontend and start work on that and on this lecture we will start first
[02:13] by add the environment variable for the URL that we will gonna use for notification and also we can create the notification store or we can put the file that responsible for this on notification store okay we can call this we can call it view this should start with view app then
[02:40] the rest you have real time notification you are ever what should equal to WS column double slash localhost
[03:06] column 80, 80, 80, sorry 80, 18, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80,
[03:36] .js all right we need to start by create that constant that we are going to use it later we're going to just call it a real time notify
[04:06] real time which will equal and here we can add this date it is just simple store but it directly use the web socket and we can export this export sorry export
[04:35] default real-time-notify all right then we need to come up here and start by add state WS here we can put our web socket we'll just make it null user
[05:03] ID, empty, notify. We can add the notification list number. We can call this notify. ID's list number.
[05:30] i just have this just zero after that notify id data leave this small okay formatted document okay after that let's just define the getters
[06:00] we can call this get well we can call it getUserID which will take state goes to return state.UserID
[06:30] right we need to add a comma here we can now duplicate this vector for another one call this get notifyIDsList and this one call return notifyIDsList
[06:59] number of course list number let's just call it list number okay let's just leave it with the same name next we have the mutations mutations we can call this set underscore users
[07:27] underscore id state, tick state and just check if jso parse local storage dot get item profile we can say state
[07:56] dot user ID will equal to all this can copy the sport just paste it here dot result user ID result dot
[08:23] under score ID right we're good this is the first thing second one we can call it set under score WS which will take state and the WS itself which will equal state not WS equal to this WS or WebSocket
[08:52] Next, we want to add, add under core notification. State and notify. State.
[09:21] notification number or equal to state dot notification number plus one state dot notification notify ID data or equal to this notify
[09:44] after all we can lock this I don't see this useful here showing adjust to make connect on of course on actions here is the mutation actions async
[10:12] connect to notify contacts all right first of all we need to check if contacts state
[10:40] user ID and contacts state WS both of them is equal to nil on that case we can just start doing this
[11:06] we need to have the URL we can just say const the connection URL URL anything equal to process dot env dot env dot view app what it called
[11:33] just copy it and paste it directly here this is the first thing after that we need to define the context the web socket can just say equal new web socket back text dollar sign URI
[12:03] I think that we can actually ignore nearly all this
[12:31] I don't need this shit user ID. Let's just remove it. We want to make this much easier. Let's just remove this one. Get notified. Yeah, let's just remove this one. And this set user ID. We need to copy it.
[12:59] remove this come up here now we can just check for this one here on this port okay and if that decays we can just remove this and this and we can just say
[13:28] first user ID is equal to this one and depending on that we can just remove this one paste here alright we are cool until the sport but after that after we creating this we can come up here and say WS
[13:58] on open what we want to happen to make we want to make this equals contacts.commit set underscore ws and pass this ws all right next
[14:27] when on message want to expect the event which will goes to CONNEST notification which will equal GSO PORTS event dot
[14:56] data next we can say contacts commit add underscore notification what did we call this add notification just copy simply paste it here
[15:25] add notification and pass this notification let me just fix this call it just notify okay I think we're cool, don't need to have a function to stop the connection
[15:51] or not sure I think we need not just create it anyway to be very simple where are we let me just look at this yeah here can come up here and start say async stop connection to notify
[16:21] which will take conducts we can simply here say Troy sorry Troy catch here we can just say notifications of it
[16:48] or we can just say contact dot WS dot or we can call here or we can just say disconnected
[17:15] contacts we need to set WS, just copy this paste that here, change this we need to change this to null
[17:40] and after all we can just came up here say console sorry not contact console dialog error pass the error all right and finally to be able to use this we need to go to the index and add this here
[18:08] to import realtime.notify and we need to pass this here ok, we just hit save and we are now good we need to start use it and the correct place to use it is on NavVar
[18:34] We will start doing this on the next lecture.
[18:38] you
