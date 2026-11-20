[00:00] hi and welcome on this lecture we'll start move the notification through our API all right first fold we need to come up here on API and start create a new a new directory we can call it real time all right
[00:26] here we need to create a new file we can call it notify service or server notify server look go okay cool now we need to go to the notify this is what we got on package on real time this is what we have
[00:55] okay we just copy all this and just paste it here and start work on that one by one the package name is also realtime all right why do we have an error here not sure think this will go to disappear right now in a
[01:25] we do have multiple errors one of these errors is that this actually not part of the app of api application okay we have notification was all the in the data all not change that are all maybe you can change this one
[01:54] from avatar to imageral okay next to sync we need to create
[02:23] holder for the connection we need a new type just call the new type notification manager just say type which is struct connections map of string
[02:53] pointer of web socket connection or con all right we don't want to have this first we don't want to have that one okay
[03:23] In order to this error to disappear, I think we need to come over here, say go mod.id. Wait until the download is finished. Okay, we're done. Now this won't show error anymore. Alright, and...
[03:50] after that we need global to make this manager finished and it's a global for that all we can do is just make this a little bit bigger go down say more notification manager and then
[04:19] we want to take a pointer of this notification manager all right after that we need to initialize this instance so we need a function let's just call it the init function which will initialize this notification manager this one goes to pointer of notification
[04:48] and we can give this connections we can make map string of socket connection just like that next we need to return the global notification manager
[05:16] for that we can have a function func get notification manager write this for the terminal pointer of this notification manager
[05:45] okay you can just directly come up here or return this notification manager okay we're cool this need to be capital G all right now when we we can handle this and inside the same package
[06:11] and at the same time we can return it to use it globally okay what we need to do we need to have multiple methods then we can use it outside this one first one for notification connection and just store with a funk
[06:40] i just say nm for notification manager stands for notification manager pointer of notification manager then the name of the function can be add notification connection okay this will expect user's high
[07:09] which will be a string the connection so it will be pointer of what socket connection or con all right all we can do here is something like what we have here
[07:36] all right let's just write it down say nm.loc.loc okay we have something not right nm.loc.loc.loc
[08:04] notification manager where is this notification manager we missing this we just store by added say notification manager lock will be sync
[08:32] romutex just hit save go back ok now we can use lock next we can defer nm.lock not lock again this time unlock
[09:00] okay after that we can just say this nm connections for this user id well equals to this connection okay what next we can just log anything here log printf
[09:29] we can say user % as connected to notif equation server ok pass this user ID alright next we need to have one for more deconnexion it is actually
[09:58] looks similar all you will do here is very they are so close to each other so i just copy this and say remove notification connection okay first we'll do the same thing but the only change will be here i just remove this and say delete
[10:28] give it this nm connections the second parameter will be the user id who didn't need to define this connection since that will not going to use it so just remove it next of that we need to change this user this connected
[10:57] from notification server alright, we're off the road this actually unlike what we do have here this infinity for loben and all of that we didn't need to have anything like that since that we won't have it work by this way we will not expect incoming
[11:25] grpc signal for us so what we can do here is to come up here and have a function that can send notification directly so let's just say func nm pointer of notification manager nope
[11:55] pass dps1, ok, the asterisk story we can name this send notification to user this will expect the user oid it shouldn't be a string notification
[12:24] what should be pointer of this notification? not pointer, the type of it would be this notification that we have over here so what we can do here is to store by say nm lock relock the connection
[12:52] we need to have the connection and the exhaust this will return to us from nm connections for this user id after that we can just say we can lock this or re unlock it re unlock it okay
[13:18] next we need to check if not this exists just add this here you can just say log printf user percent has not connected
[13:48] and pass the user id then we can just return no okay no we don't need to return an error the user just isn't online so we can ignore this ignore returning an error all right
[14:18] after that we can just say error of this connection at right json this notification okay i think we can copy this one or we can just
[14:47] Do it by this way. No need to do... Do I need to have it by the same way? I'm confused actually. Actually I don't think so.
[15:12] just go back here and say error all we can do is to check if there is any error we can just say f error not equal to 0 in that case we can just say log printf
[15:38] on that case the error will be sending error sorry i need to add double quotes error sending notification to user %s unopened to pass the error itself so %v the user sorry sorry sorry user
[16:05] ID and pass the error next we need actually to use this NM to remove this connection so this is mean that the connection is broken on that case we can just return the error okay and after all if we don't have any error we can just
[16:34] look printf notification send to user double percentus
[17:00] we can now pass the user id and notification details and after all we need just to return all okay we didn't need the rest anymore the last message or sorry last function we needed is to get the connected users
[17:30] so we just say hunk and pointer for this notification manager get connected user connected users okay this will return oops what is that
[17:59] So,
[18:28] all right this will return a slice of string okay all can do here is
[18:57] to relocate and unlock just like we do here here we just copy this base dot here okay we need to defer this all right next
[19:25] all we can do is to say users it will have we need to say make slice of strings zero and the length of nm connections
[19:49] okay after that we can arrange for that we can just say for user ID it's all goes to range on nm connections then say users all equal to append users and user ID
[20:17] okay after all we can return that user all right we're done with that i will not fly on the real time it's ready now what we need to do is to start have a setup we need to set up this outside here front cmd
[20:45] on a separate file just start working on that all right i just came up here on cmd start create this set up a real time notification to go all right set up real time notifications all right
[21:12] now i can just say package mean and the function we can name it set up real time notification this one take up pointer of fiber dot up all right we can log this log
[21:41] right next we need to store by get nm hard notification manager
[22:09] so just say nodevqtion manager all right now we can use this real time dot now we can use this get notification manager methods all right we can add also endpoint to health
[22:39] i just say something like status and status and point up.get slash notification no i don't think notification
[23:09] right here we need to have fiber hot app no no no sorry fiber with C of course fiber contacts fiber CTX all right
[23:38] and this of course should return error or null okay next we can just say connected connected users which one goes to notification manager get connected users
[24:07] next we need to return c.json.fiber.map.status active and
[24:37] connected users we can pass a line of this connected users and we can also return the users themselves just connected users
[25:03] all right we're cool next we need to set up the web socket route so i just come up here say op socket route for notifications okay i just store by say ab dot get
[25:33] Just slash notifications. Notifications, we just check. We need to write down this correctly. K notifications slash WS.
[26:02] okay if we go back here and see all of those here is around the server which will have something something similar to this just ws user id and after that we listen and return the message okay adjust
[26:30] now go back here where are we up here i need to use a little socket but new funk
[26:58] or the function c or something exactly like that inside of that we need to store by get this user id which will equal c.perms user id ok, after that we can log printf
[27:27] new connection web for ws for user s and pass this user ID okay all right next we need to do is to came up here say notification manager
[27:56] add notification connection both this user id and this c address represent connection or socket connection yeah next what i can do is to closing the notification of site so we need to set the fure func we need to call this so we need to add it
[28:25] say log printf not perfect printf can just say closing notification WScon for user for user
[28:55] and pass this user ID next we need to say notification manager remove notification pass this user ID next we need to say c.close now we want to keep the connection alive keep on
[29:24] so we need to have this infinity for loop we didn't care about the response the first two responses
[29:51] but we care only about the error message that can come from see or read messages then check if error not equal to a new on that case we want to say log printf not if a cushion
[30:18] web socket error for user and pass the error user id and the error ok and then we want to break this loop alright final step on this lecture that we want to make
[30:46] is to go go back and call this here so below this one we need to come up and say set up real time notifications okay just say set up notifications pasto in the app
[31:15] okay we just try to run the application one more time we need to add cmd slash set up real time notifications we just go back remove this one directly see cmd
[31:41] Hit enter and see you are outtubed All right, hit on the access Great, we have set up real time notifications Right, I know that you might be now confused where exactly this run and go didn't try to create a server because all were run on the same on the same port on 5000
[32:10] and it will do the same exact mission. Alright, for example here we have this WS user ID and we have this one for notification status. Now just check it, see what this will give to us.
[32:38] Can you see? Status is active, connection user is 0, the list of the users is empty, so it is also on the same port which is 5000. Now all the services will run on the same port, notification, realtime messaging and the API. Very well, on the next lecture we will start to use it.
[33:07] inside our app and test it, so see you on the next lecture.
