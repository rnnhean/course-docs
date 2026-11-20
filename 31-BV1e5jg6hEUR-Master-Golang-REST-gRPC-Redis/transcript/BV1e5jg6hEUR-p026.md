[00:00] hi and welcome on this lecture we will start building our first endpoint here which is for sending the message but note that this means that we want also to create or update the already did message record that between these two users all right I just start by go to the routes start create the routes
[00:29] for chat, we can just call it chat routes.go ok, we can just copy this one and paste that here, just change this to be setup chat routes to setup post routes to be setup chat routes i just leave it as it is right now but we need
[00:57] to go to the main and go down here all right and store say routes set up chat routes pass that the app dot all right finally head save and now we need to go to the controllers stock it chat controller
[01:26] okay now we can also for example I just say that we will copy this one and paste that here all right or else we need to do we need now to go to this chat routes and then remove this one
[01:55] remove this comment and just go back here or I think I already remembered it we can directly come here and say chat slash chat send message
[02:21] controller who didn't need any kind of validation all right controllers and we can call this send message okay now we can copy this one close the chat controller the os controller and come here change it to the same name
[02:50] all right now just like we had with this one of career post if you go back here now when you just start save this save okay now go back as you can see you have something like that so we can copy this one okay
[03:16] and we can now move to the chat model is that here we can call this send message m for example right while we are expecting on this as a matter of fact we expecting all this
[03:44] ok so we can just put all here the content, the sender, the receiver and add all of them this one the content we can copy this one and make it for the content alright
[04:14] and the sender and receiver we can just copy this one here for the content on the receiver all right cool now we can remove this one and now we can go back to the chat controller
[04:40] all right now let's just go back to the reverse controller actually we need something exactly like this one so we can just come here remove all we got here and paste that here but just let's just leave this for now and now we can just start
[05:08] here on the documentation let me just stop by the name send message send message to friends all right sending message
[05:38] sending a message can you say from one user to another all right something like that okay the tags can be just chat okay what else
[06:05] the model can be if we go back here okay this one and paste that here and we can just say users and message details okay dot dot fine okay this one can be message
[06:34] all right and then we can just came here and change this route if we go to the chat route you can copy the route from here just paste that here and it will be
[07:01] post can just use our body this one can be message all right then we need to define the message schema
[07:30] okay the collection messages and also the early-date message scheme and this one will be on
[08:00] read it it's actually exactly like what we have here where is that it is actually here copy it from here paste it here
[08:26] okay we need actually to call it something else we can just call it unreaded messages okay we need to have the same name each time all right or after that we need to come down here change this to
[08:56] send message all right or after that we need to define the message variable can just say war mhg models message okay first we need just to save the message to the database can just say save the messages
[09:25] 2db for that we can just say result error and then we can just say message schema oops message schema insert tone burst the contacts and we can just
[09:53] to come here and say c.bodyPorsche off this MSG alright and we can come here and say
[10:21] pointer of this image. All right, that's cool. I'm gonna just copy this one. We can here check error, error, oops, not equal, nil. We can return this one. We can return error field. Double save.
[10:51] ok or else now we have the result for that we need to come here and say update or create the unreaded message count and it's
[11:20] call first we need to define the variable we can call it unreaded mhg models oops models unreaded message alright second we need to have a filter so we just say filter
[11:49] i can just say peso.m the main user id can be this message as i told you before receiver
[12:15] other user ID can be the message not sender okay or else I need actually to have the update after the filter we'll just say update
[12:42] which will be pson.m can use nc operator for pson.m the num of our rated messages so just go back for that
[13:12] okay it's actually here just directly copy it from here to make sure that we have the same name number of our related messages we want to increment this by on okay after that we need to have comma and we can use set operator this time so
[13:39] dot M is a read it this should be false okay or after that I just had option options dot find
[14:09] one and update not set absurd to true okay if you come down here you'll see absurd sets the value for upsets field this is why we need to use this all right
[14:38] we need now to say error portal equal to this unreaded message schema dot find1 and update pass the contacts the filter
[15:04] the update the options we want to decode all this with this unreaded message with unreaded message
[15:33] this one that we created here all right, that's cool now we want to check if the error not equal 0 and error not equal mongo oops, won't go up
[16:02] dot there are no documents we can return we can just copy this one yeah we can just copy this one paste that here and the message we just change this to message
[16:30] say failed to update untreated message count all right we're cool after all you can just come here say return the created message
[16:59] return c.status fiber create JSON fiber.map message message
[17:29] send successfully. The result can be a result.inserted.
[17:58] all right now we can just hit on save the unnecessary packages will be removed then we can just come here hit on mixwag and after that we can just say air and after that we can just go to the browser refresh
[18:24] okay as you can see we have here chat just hit on tryout go back here social users we'll just copy this id and see the sender okay c4 can be isle
[18:54] paste that here the content to can just say first message from Ahmed to Iso and just pass number on here hit on execute we have messages sent successfully
[19:15] If we go back here and we need to kind of refresh We can just hit on the refresh As you can see we have unreaded message this has been created Because if you remember would you add the upsert here? This will create it if it not exists
[19:43] the main user id is for isle, other user id is descender which is Ahmed and the number is 1 is really defaults just send another one just say second change this to 2 and execute go back refresh this one we got number 2 on messages
[20:12] we got two messages all right just start reverse this cut this paste it here now cut this paste it here as well and change this to first
[20:42] message from isle to ahmed change this to one hit on execute after first just add the second I'll just
[21:10] send multiple messages if we go back refresh we have the second and third what about the unreaded message we need to refresh this as you can see this has been created as a separate record all right i believe that's all i'll just send some messages you can just follow along with me or get out from now and stop the video
[21:39] and go to the next lecture but this will be used for the second lecture so I just do this after the second let's just say third execute fourth
[22:07] oh i know i can just say message num5 execute it is much easier num6 okay num7
[22:36] Number eight Number nine All right, I believe that's cool if we go back fresh this you can see we got nine and two All right, this is the total number of messages between both of them of a cure found
[23:06] all right I believe that's totally cool or cool we can now move on to the next lecture
[23:19] Thank you.
