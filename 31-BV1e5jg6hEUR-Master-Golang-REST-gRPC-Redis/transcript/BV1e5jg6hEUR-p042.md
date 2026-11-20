[00:00] hello and welcome on this lecture we will start implementing send message or save message function or RPC all right below this one I just start by creating a new method and it will be look like this one I just close this up have kind of space here and start by defining the function on the same signature
[00:29] on the receiver server the function name is and message node that they should inherit this so we should have the same name CTX contacts dot contacts request
[00:59] ppmessage request response on ppointer of ppmessage response or is that did we create a message response or not yeah here it is so what is the problem
[01:29] no this is not a pc message response yes this is pp ok and there are some more as that first of all we can use this request to get the sender from the receiver who have already that built-in method so i can just say if request gets sender
[01:56] Note that this message is created for us. If we go through this, you'll see that this has been created here for us on popup.go, okay? So we can't directly use it to get the sender parameters, okay? Or request.getReceiver
[02:24] collico to empty string on that case we can just return nil and fmt rf sender and receiver for required okay then we can add the
[02:52] dmongologic datavis.dv.collection no no no datavis.dv.collection
[03:21] of these users first of all we need to check if both of them are exist or not ok we can just store by say sender sorry sender
[03:50] underscore, this one goes to primitive object id from hex request.gut sender just remove this one
[04:10] After that we can duplicate this one, this would be a receiver. Change this to get a receiver. Right of the rat we can define a variable of this model, userIT sender, receiver,
[04:38] models user model okay after that we can say sorry sorry sorry error goes to user schema dot find one ctx remember that we already passed this from here okay
[05:08] dot m underscore id sender id All right, we want to record this to the sender
[05:34] okay and we can check if error not equal to nil on that case we want to return nil with fmt, error ref and sender not found alright
[06:00] Now we need to duplicate this. We didn't need to define this error, so we need to remove this one. Da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da-da.
[06:29] Both of them are found, now we can save the message.
[06:58] request get content sender request get sender receiver request not get receiver all right that's bad yet now we need to came up here say underscore error equal to database
[07:27] db collection messages dot insert one
[07:56] ctx and message for that we are going to check if error no equal to 0 on that case we can return sorry return return 0 fmt errorf field
[08:26] to save message to db okay now and finally we want to update the unreaded message schema
[08:51] I can just say that this will equal database.dv.collection.unreaded.message.
[09:18] first we can define the variable we can call it existing record which one equal mtps on m after that we can say that the error was equal to unreaded messages schema
[09:43] dot find one and update okay we can just store bypass the ctx or the contacts and mpason dot m for i want to search for menu where this main user id main
[10:12] user id is equal to this request dot get receiver at the same time the other user id other user id request gets under okay
[10:40] and the updates that we want to do is pason, we can use pason m as we already doing this before dollar sign ink or increment increment yeah ink pason dot m num of 1
[11:09] readed messages you know I'll copy this from the database I just go back here messages or readed messages it's on here we can directly copy it okay go back I'm off on readed messages
[11:35] but we want also we want to set PSON.M with reddit do we write this correctly just check this copy
[12:05] go back here is reddit or edit false ok after all we want to record this to existing record
[12:31] simple as that now after we got this record what we can do with that actually this will allow us if if we have already existing record to update it but what if we don't have so on that case we can check if error not equal to 0
[12:57] ok, on that case we can say underscore errors this all goes to unreaded messages schema insert one ctxpeso.m a main user id and other user id will be this
[13:26] so we can just copy it best at here main user id and other user id and the num of our related message so just copy this one and of course we'll make it on so we can just have it like this
[13:55] but we didn't need to have this piece on, we can directly pass it like this say numfalded messages is on since that we are creating it is redid is of course false
[14:23] just add a comma we are good here so we can finally check if there is an error not equal to 0 on that case we got return L and FMT error F fail to update
[14:52] don't read the messages okay after all we can return the response we can just say return pointer of PEP dot message response message request dot get content
[15:21] and add nil here to the error part and actually we can now say that we are ready okay why we have an error here error should not be capitalized where is the capital let me just fix this make it small okay
[15:47] We do have the same ones here. Let me just fix it as well. Do I have anything? Where did I cut it off? Should not say or what did that? Arrow stings, should put in twice on this and all.
[16:15] your lines okay is this called right now okay now we need to rerun our app of course we can use here to have kind of
[16:43] refresh okay in a way we can just now go back what we want to do is to go to the database I want to remove this one or drop this collection
[17:10] and this one as well okay note that we are now doesn't have any messages or hard reading messages okay now I just copy the gRPC URL first check if the app is running correctly okay gRPC running okay
[17:40] now we want to test this send message say here's the example message sender or descender just say that descender would be this user okay this user or this ID the receiver would be one of these users
[18:10] all right now that the order here on the json doesn't make any difference we can change the order okay the content we can just call it first save it message via grpc okay what will happen
[18:39] if we head on invoke okay this returns us the message which is mean that this status code status code okay meaning that we didn't have any error just check this out we need to refresh this say refresh databases all right we do have the message sender with the same sender ID same receiver ID first
[19:07] message we have jrbc what about jrbc message okay it looks like great what if we try to send another one second same book go back go and messages refresh we have another one second message that's great oh no i don't read the message this should be updated to b2
[19:37] Great, great, great. Everything works fine. What if we just change this? This receiver, for example, and try to invoke. As you can see, it tells us receiver not found. Great. It looks like that everything works fine. Our servers, GRBC servers work perfectly. Now on the next, we want to start
[20:06] create the client from the real time to be able to save the messages with real time as well as getting the user friends on real time to be able to get the correct online and offline user friends list etc.
[20:31] and let us just start work on that on the next lecture so see you on the next lecture
[20:37] you
