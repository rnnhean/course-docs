[00:00] hello and welcome on this lecture we're going to work it on the real-time oncoming messages on navvaryers okay what we are going to do is simply we can just copy the sport all right
[00:23] then go where, where, where, the, in, uh, board. That's great. Um, blow this one. What we can do is very simple. We can just came up here and say add this one, close this, add comma. We can do all this.
[00:51] or just leave it as it is ok we can come up here and do something very simple we can just await ok for this get unreaded message num and then say this
[01:21] get user data dot result dot underscore id dot then and then say this unreaded
[01:49] message count we don't have this already did message count we need to create a function that will increment the message count and let us create it here first do have this solid message
[02:17] no I just ignore it and call this a read message count okay now we need to create it and for this we need to desync yeah I desync
[02:42] I have this one just do this one below this one say unreaded message count okay we can just have kind of set timeout this should work on less than second say this message or this unreaded messages
[03:12] will equal to this chart dot on sorry I think I need to call this chart where map state
[03:39] is this actually is useful saying we have on the rated messages okay
[04:01] can i just copy this one what we are doing here on unreaded notification it's too good all right i think is
[04:28] It is better to call it from chat. Alright, now we can come up here and call chat.chat.unreadedmsg nom.
[04:52] I prefer to go up here, chat and get this one. Now I just go back and call it. Okay, I need to close up this and if we go back now, I think we're ready.
[05:19] I think we already adjust this and see how we will have ok, we have message defined but never used ok, to calculate this is what we are looking for alright, we are good, we are good here we just go to the shot
[05:47] try to send message okay this doesn't update it this is doesn't update it why is that despite the fact that is if we refresh we'll have one message right now okay
[06:16] I just close this, come up here, say again, anything, this doesn't update it. What is that? Of course, unreaded message count. Okay, this is...
[06:44] Really weird.
[07:01] Can we not do something like that?
[07:29] Okay, I just save. Right, I just refresh new pages.
[07:56] I'll go to a node and say send node that this is 2 if we send this this will give us 3 this doesn't give us 3 actually okay this is really worked okay all we can do right now is very simple I can just say
[08:25] when we go and get function when we get just define the all-expecting message here okay next what we can do is to call this what they call this unreaded messages plus one
[08:53] on this one we can just remove it okay and when the route is changed we need to call also this unreaded message count yeah that's perfect
[09:23] or actually I can do this is to copy this one and paste that here now I just head save going back what we have message is defined but variable no variables no okay okay I just remove this message head save
[09:53] go on back refresh this and this note that this one is 3 I just say 4 message hit enter wow this doesn't obliterate this is really weird why is that?
[10:19] just see message come up here see console.log new message real time pass this message hit save and now go back try to inspect
[10:47] clear this out come up here and now send message okay we have a problem that this doesn't work correctly how is that again
[11:16] Is this message sent correctly or not? Okay, we receive message from the right. The problem is actually here.
[11:39] this is really worth our real time we need to have a log here we'll just say console.log stores real time
[12:05] and pass this message ok hit save and then go back clear that art come up here clear this say anything ok it is updated on real time it is updated correctly on real time and add this private message
[12:34] where this private message which is update private messages by default so real time what the problem of having this I don't know I just say save
[12:59] try this once again ok something is not right actually everything is right you know I just try the old way the old fashion way of doing this
[13:27] okay we need to keep this as this already the message can't and we can keep this on as it is we can keep everything like this but the idea here is that we need to call this real-time chart here on the app state
[13:57] and i think that we didn't need to call this chat since that we are not using it so we can just remove it i just hit save go back i can close this one go here hit messages okay go back
[14:26] open both of them i'll just use this one again hello again enter as you can see this has been updated directly will come back this has been updated to again
[14:52] this has been updated to 3 ok if we go up here we have 3 and we now this is now should disappears but it will not disappear until we change the route as you can see it is actually works perfectly everything works perfectly and I think nearly this is in general all the updates that we want to make on our app
[15:22] Now we want to configure the GitHub We need to configure GitHub actions and also want to know how to deal with all these services on a backend with our front-end via Docker compose and Docker in general and maybe we can have kind of tests for this as well next
[15:50] we will gonna upgrade our app on the next section next after that we can have some single like deployment or anything like that but for now I think that everything is works perfectly we can now move on to the next lecture so see you on the next lecture
[16:12] you
