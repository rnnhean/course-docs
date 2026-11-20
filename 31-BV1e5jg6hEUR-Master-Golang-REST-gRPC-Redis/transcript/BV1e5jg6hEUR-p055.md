[00:00] hello and welcome on this lecture we'll start specifically use this real-time chat to get the online users all right first of all we just go to the real-time chat yep
[00:22] and we need to come up here and add this condition just like we had with the rail time notification is to check first if this not equal to another okay or else we need to add this one as well
[00:50] copy paste.year below this one as xd.com and call it stop connection to chat. I don't can keep to rest
[01:17] all right next we need to go to the authentication and here we have this connect to notify we need to add another one while we name it here is to connect on a realtime notify now a realtime chat we want the realtime chat
[01:45] we need to call here as well this create chat connection
[02:12] also we need to call it on this place okay create chat connection this is on the register and this is our login I just now had save
[02:35] and next we need to go to the navvore we will gonna work on that later on but we are now care about the i think logout yes stop connection to notify we need to add another one real time chat stop connection to chat just copy and paste it here
[03:04] we need to add comma of course and we can call this this stop connection to chat we're all now we need to go to the app.view and to use it here as well
[03:30] because this is where we should actually call these things. We have connection to not high, stop connection to not high, we need to add two, another two, matches on real time, not on real time chat, just copy this one, paste it here.
[03:57] and copy this one and come up paste that here okay here we need to say this create connection, chat connection and come up here say stop connection to chat
[04:26] it is not called chadv we just fix it yes now we can head save all right before we move on let me just start to run all the services on api what it called it called server i believe yeah it called server all right
[04:55] here we are in ethai server okay next here we are in real time chat real time chat no real chat okay yes hello access finally here we need to run
[05:22] real time notification yes this one all right we just close all this done and then go back here on VS code and now we can go to the chat where this chat can we just also run this front end
[05:51] here run solve okay now we need to go to the components chat chat component all right okay now we need to go to the map computed sorry on computed and add the map state
[06:15] real time chat and just make sure that we have the same names okay this one copy best it here all right now we need to check how we do have let's just close on this unnecessary for now get your sness
[06:43] Selected users and messages on the scroll Unicorn line. Where do we have this one? Okay, so how do we
[07:10] How can we deal with this one? Or actually why this should give us positive? If we close this we just go open up this one, open host, no, no, no, not this one. Open host host, we just say hey at...
[07:38] a.com we need to go to the chat how this goes agree and think if we take this out let's save okay understand so this unique online users is not use it till now that's cool what we are gonna do is we will come up here
[08:06] and say watch okay and we will come up here say real time chat not online users we just go back here back back back back or we call it online friends
[08:34] online friends we want to watch the changes over there function new value or friends we just call it f or online online friend I'm not sure what we should type here let's just say online
[09:04] anything the new value anyway I just say const online friends array with equal to object dot values pass to it this online okay
[09:32] all right next i think we just we need to log this console log online friends changed new and pass this online friends array okay next we need to say this unique online users this this
[10:02] Unusable to think. Here. We need of course to close this one. This should equal to array from new set. Online friends array.
[10:31] Yes, this is the one we need to remove. Okay. And actually now we need to update the online lessons.
[10:59] all right we can do this on a separate method let's just start by call it first we can just come up here say this update online list okay you just start work on that below this one update
[11:28] online list yes all we want to do in this function is simple is to add another object to each contact or user or friend we can call it is online and pass whether if true or false depending on that we can check this on the template part okay we can just store by say this
[11:57] contacts dot for each one of this contact what I want to do is to check if this unique user includes hot contact underscore id
[12:27] if that true we can just say the contact now we can add another object is online and simply say that this is true all right else contact is online say false okay
[12:56] don't need to call this on several occasions i think yes below this one we can call this sorry say for edge format documents okay let me just cancel on this get yours list
[13:22] open up this one we can call it here as well this update on my list all right i think we're cool just now go back to this port where we should doing this all right and what we can do over there is
[13:51] inside this one we can just add a vf condition vf if what this contact is all line this should be positive and this should show up if this one line yep
[14:20] now all we can do is to hit save and check out this one go to the console can we refresh or something yeah what do you have on this we have disconnect and connect from the notification all right on this this closed okay
[14:47] ok we need to focus a little bit on this one all right just close this one and we are going to do it right now so we are going to go as a ghost localhost auth s at s.com ok we need to go to chat and inspect this
[15:16] and see how we will have all right as you can see this give us ISO now it is online that's great should give us Ahmad online as well why this doesn't show Ahmad as well as online why this doesn't even work this already connect
[15:46] all right let's see oh it is not working okay what if we go to the home all right next go back to this one it is doesn't still doesn't show up online okay what if we refresh this give us a half is online if we go back very fresh okay it is give us
[16:14] so it's also online all right it looks like that this works fine all right that's cool if we go back here this doesn't work correctly let's just check this one go here and go here it's okay
[16:42] still not working correctly why this happened because the online friends doesn't change if you remember we faced that problem before it should be far to be able to get this one online friends okay so all can do for this is to get this one directly
[17:10] check how we are gonna we're going to do this we need to we're here from mounted just for example say console dialogue real time online users okay and then can we just use this real time chat
[17:40] dot online friends and then hit save if we go on back real time okay we need to define let's just say xxx hit save okay go back go up here clear this out
[18:10] and then go back, we have online, okay, what we can do right now is to go back here, and then what we can do is to call this function, update on my list, it is nearly to do exactly what we did here,
[18:38] we also copy this paste it here we didn't need to have this one or this one can directly cut
[19:07] paste it here, we can close this and cut this, paste it here ok, now just close all this, head save and now we need to check this out ok, this works here
[19:37] works here as well if we now go to the home next go back okay still working home go back okay this also still working but if i could decide to log out is this all effect here
[20:03] this should effect it here actually we don't have a problem ok cannot really do all of this connect all right ok we need to check this error take it a little closer closer look maybe that's because this is doesn't have this disconnect
[20:32] method it may use close I just check this on go to the real time chart where are we just say F contact WS on that case we can just call this
[21:00] all right just close I think we need to do the same with the real-time notification but this doesn't affect our real-time notification but anyway real-time chat, real-time notify I just go back paste that here
[21:29] hit save and save this one and just test it on this one or just give it my best I just say a at a.com now this is s at s put the password login
[21:58] okay as you can see this directly give us that this is is online now go up here all right look like that this is work perfectly Ahmed now is online all right what we are looking for is to when a when a hardware will log out this should shouldn't give us an error head on log out and this should be an offline now
[22:27] or i could look like that it is still offline so what is the problem is handling the logout meaning handling updating the online on backend or what we'll just make sure we're coming up here go over this one
[22:53] we start here but now just close this one if this make this offline this means that handling is totally correct but problem is that this one is actually doesn't work let's just go back and look at this and I think the problem is actually here because we don't have an access directly
[23:23] to this ws so all we can do here is to fix this one by coming up here and say state dot state ws contacts dot state dot ws okay adjust
[23:52] copy this one, go to the notification, paste it here, hit save all, go back once again, oops, go to the authentication, just add this one. Alright, so just inspect.
[24:21] go to the console clear all if we go on back right now you'll see that it is back online go to the chat okay great it is online but if we now head on logout this will go back offline great that's great this is mean that everything now is works fine with real-time online user
[24:47] And now we can work on real-time sending messages on the next lecture. So see you on the next lecture.
[24:53] you
