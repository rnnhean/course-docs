[00:00] Hi and welcome! On this lecture we will start send and receive a real-time message. Very well, I just started by going to the chat component and what we need here is to go to send message but to be able to do this I think we need to use store actions
[00:26] but we didn't create that hit so we need to start by create it just go to realtime chat before this stop connection we need to define another one async send private message
[00:54] okay this will take contacts message one we need to check f contacts state w s if that the case we want to return
[01:23] this contacts state ws send jso string file the message all right now let's just go back here on send message
[01:52] and we do have this one here right, what we want to do is to come up here and cut this one and came here and have like check F not this unique online users includes include what? there is yours
[02:21] So this means that this user is not online. Okay, let's just fix the indentation by ourselves. Here we need to say else under here is the part where we're gonna do this. We need simply to say this send private message.
[02:50] okay we need to call it first just go back here put this one and then go back here send private message as data okay this is the message
[03:17] say done, it's all goes to this message between users, got push, this is data, right?
[03:44] and after that we need to scroll down just like this one so let's just copy it and paste it here ok let's just say ok we need to do it by ourselves alright this part is done now we need to come up here and we need to watch the upcoming
[04:13] messages okay we just came up here say real-time real-time chat dot what we are looking for if you just close this one if you go back here what we are looking for
[04:38] if you remember whenever we get a new message we got this one private message which will update this one so what we are looking for is this one private message so this is how we all want to watch then we want to save a function we have message
[05:07] we can get the odd value but this is not important and then we can just start by say f in this or we can call it directly contact now we need to say this contacts dot liens is bigger than zero
[05:37] on that case we can just say this contact out for each while we are assuming now that we are receiving a message while while why do you have this error I didn't save this
[06:05] anyway is that we have users here users list here at the left and we receiving message at the same time on that case we want to update the message number on the already the message number okay okay we just go back for now say for each
[06:32] contact this one goes to and here we can check if contact underscore id is equal equal to the message dot sender
[07:00] Assemble as that. If that the case we want to say contact unreaded message. We want to increment this by saying just pass pass. Okay. Or else we can just came up here and say F.
[07:29] this selected user now we are assuming that we open this chat between this between ourself and that user okay how we can check this boy say this not selected user not underscore ID is equal equal to the message that we received senders
[07:58] the key so I want to do we can just say this message between users .push message after that we can just say set timeout okay timeout just one second below actually it's one
[08:26] on 10 seconds all i want to do is to say this scroll down function and we are good here if we go back right now we will have an error something is not right just refresh okay just
[08:54] Refresh this as well. Alright, let's just use this. Need to make this a little bit smaller. Okay, let's just say we will open this. Hello.
[09:19] Well, if we send this as you can see this get receiving the message directly Hello, how are you? Try to send you can see this give us Hello, how are you? Okay, let's return this find things Return this again as you can see
[09:48] If we click on that, the unreaded message will disappear. If we click on that, the unreaded message will disappear as well. That's great. Okay, what if we send a message to Animo? Hello Animo. Alright, that's worked perfectly. On the next lecture, we want to work on
[10:18] unreaded messages or real-time unreaded real-time unreaded messages here on the var and on that point we will be nearly and with that with our application on this on this point we will nearly download that having everything we will gonna upgrade our app on the next lecture on the next sections
[10:47] and deal with deployment etc. We're all for now, just go to the next lecture.
[10:54] you
