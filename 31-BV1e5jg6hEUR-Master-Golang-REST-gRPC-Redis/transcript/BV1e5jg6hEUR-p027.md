[00:00] hi and welcome on this lecture we will start creating the second endpoint here which is getMessageBoynoms all right i just stopped by going to the routes we need to go to the chat routes we don't need this anymore i just came here say up let slash chat slash get
[00:28] msgs by nums all right controller command post no get messages by nums all right just copy this oh we need to change this a little bit okay
[00:57] and go to the chat controller and just copy this on and simply paste that here all right now we need to copy the name that we passed here and just change the method name all right
[01:24] now we need to change the send message with your name what did it need to appear we'll just do it by on by one all right we can just continue saying it messages by page nation okay tags is the same description
[01:53] we can just say get message by norms between two users by page niche all right okay what after that we need actually to send to have three perms let's just remove this one okay
[02:21] the first one will be from it is actually query it is an init we can just say from or store thing point okay
[02:46] now we need to copy this duplicate it three times the second two actually will be edit we need to come here after this edit we just call it nope yes we need to call this one come here and add true goes all or actually
[03:14] record the second to actually our strings okay second one will be first UID third would be second UID okay now this would be first
[03:43] user id this will be second user id all right what we are expecting to have in return kind of array of messages it will be actually a little bit
[04:12] yeah to be an array of messages overall okay we do we need to get sorry the message actually no so you can simply remove all this and we can now come and say from error
[04:40] we need to parse the query parameters say this will equal strconverter.atoy c.query from okay now we need to say f error
[05:08] no equal no can return c.status yep fiber bad request json fiber.map
[05:36] message valent value for for an error we can pass error dot errors yeah like that all right after that we need to get first the ID
[06:06] okay now to look at this
[06:35] for second uid. all right after that we can actually tick all this out for now. Unstored by the construct the filter.
[07:01] as a matter of fact there is a chance that the conversation between two users our first user may be the sender or the receiver and same for the second user for that we can now say create filter to replace them and after that we can use our operator so we can just say sender
[07:28] filter and we can just say that this will equal peso.m sender will be first UID receiver
[07:58] okay this actually doesn't change yet so we need to copy this one go back here paste that here change this to get we're called now where are we the receiver
[08:27] post post not this one i didn't need this one chat model yeah we need to make sure that we have the same name after that the receiver will be second uid right now they just don't get to hold this center filter now receiver filter
[08:56] okay the sender this time will be the second UID the receiver will be first UID all right we'll call now our real filter will be PSON.M and after that dollar sign or
[09:25] we can just say array of pson.m pass the sender filter receiver receiver filter write or call now distorting and the options skipping and limiting
[09:52] the pagination options so we can just say options equal to options not find just find after that we can just say options not set sort
[10:19] we want to get the latest messages so we can just say pistol dot d all right after that we can just aim here and say that the key will be your ID value just type in
[10:49] one or minus one all right after that we just find the limit we just say conness limit which is an integer will equal to just make it two for testing after that options not set skip and it
[11:16] 64 from multiplied with the limit finally you can just say options set limits and pass this limit
[11:46] Copy this, paste it here. Alright, we need to call this Nn64. You can just come here. Valid operator.
[12:14] from... Okay, something's not right here. All right, all right, all right. Just remove this one. And you can directly call this two. Okay, here pass this two.
[12:42] write or call after that we need to query come here down here and say query ddb can just get cursor error of querying of this message schema
[13:12] not find ctx we didn't call the contacts so we can just copy this one and directly paste it here can now use the ctx or the contacts
[13:39] after that passing the filter finally the options we're cool now we can just check if error not equal not equal no on that case we can return now just copy this simple return change this to
[14:07] internal server error can just say field to retrieve message this is the message the error can be just
[14:35] okay mirror say error dot error after all you can just say defer cursor close and pass the contacts okay after all we need to iterate
[15:00] over the cursor build nearest array okay I can just define this for messages
[15:26] which is on array models I took and just came here and say models message that I took and just simply say for cursor not next
[15:53] pass the ctx we can here define sample variable mhg models dot message error goes to core resource dot decode a pointer of this mhg all right
[16:23] after that we can just check if any error on that case can return also and sorry we can return just copy this one paste it here internal server error failed to decode message right hit save
[16:53] after this f statement we can just say messages append messages image exactly like that here we'll need actually to reverse the message array you understand what I mean later but for now just check if
[17:22] the length of this message is actually equal equal 0 on that case we want to say that this messages will equal to array models of message and just
[17:50] to leave them to after all let's just change this to ok status ok this should be ms yes and we can just come here and say messages after all it save save this one
[18:15] make sure that everything is okay all right and now we need to take our about run the swag initialize head air all right now go back and let's just open our browser now
[18:43] we have this get messages by nums okay from just start from zero first use our id i just to go back copy this one second can be also
[19:09] We can actually change this and pass the second first This will give us the same result as you can see this so we will have We will have the Message number eight and then message and message number nine Eight nine ten so and after that we will have the message number nine
[19:37] and this actually not correct if you let's just imagine that we want to return this to our real users the message number 8 send it or show it before the message number 9 that's how exactly we need to reverse this if we come here we want to check that
[20:05] or pagination work fine if i hit on execute this actually not working change this to 2 execute this works fine change this to 1 hit on execute yeah this works fine we got message number 6
[20:33] and then number seven if you know this this this need be to be reversed because the user send number six first and after that sends number seven so that's why exactly you need to reverse the array and here we can use some of dynamic programming we can just here and say four
[21:03] i need to focus on this equal to 0 i smaller than length of the messages divided on 2 i plus plus after that we can just say j only equal the length of messages minus 1
[21:31] minus i right after that we can just simply say messages where i comma messages I need to change this copy it yeah all right
[22:01] after that messages j equal to messages j messages i by this way we can reverse that array wait until arab is running now go back note this and this before was giving this first if we now hit on execute
[22:31] as you can see now this is correct if we pass number three hit on execute as you can see this is our have we have third message from ISIL to Ahmad number three then number two I just get four execute first message from ISIL to Ahmad
[22:59] second message from Ahmad to ISIL all right this completely works fine if we get five this will give us just first message from Ahmad to ISIL overall I believe that are in point work perfectly so we can now move on to the next lecture
[23:24] Thank you.
