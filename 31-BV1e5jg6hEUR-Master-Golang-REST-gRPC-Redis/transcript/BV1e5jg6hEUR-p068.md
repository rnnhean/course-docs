[00:00] Hi and welcome. Now we are going back to the backend and our mission now will be is to combine the real-time chat and added to the API functionality to allow all to work in just one command and allow all to replace the jrbc connection with the internal connection
[00:28] and here we are and what we are going to do is exactly what we did with the real time notification ok now just take a look at that we have this friends we have this manager and this friends ok now just take a look at this manager here alright
[00:55] now just go to the real time here start create these friends also we need to create this manager manager already exists
[01:23] just look at that yes we need to create manager here just say manager now go ok or else we need to have chat server
[01:49] okay now I just go back here is the friends I just copy it and paste it here and I need also to copy this manager
[02:18] and paste it here as well all right adjust save all close all this all right as you can see here we do have adjust start working on the manager first okay
[02:46] as you can see here we have this server grbc okay we have the message we won't touch anything on this port actually okay let's just check it out one by one look like that it is all good for us
[03:11] Okay, go down, we have this room of connection, or else we have this send to receiver, we have his friends, okay.
[03:33] all right the first thing we need to work on is this this one here related to server grbc send message to client okay exactly what i want to do is to directly save it to the database so we need to create a specific function for that
[04:03] we just call it save message to db write we just create that function add receiver to our function we just call it cm or connected sorry connected connection manager
[04:33] save all head is tripled remove that ok save message to db ok this will expect a message the type of is message and this function should return an error
[05:01] all right next we need to start by call CTX and cancel all right uh minute just to go back to the server grbc get friends following followers sends
[05:28] the message where it expects the contacts what you can do is very simple just grab all this okay just cut this
[05:58] just copy it and go back to the manager and blow down here and just pass this ok and now just start update this one brown alright this one half cancel all one goes to contacts hide timeout
[06:27] Contact background, just give it 5 second time dot second. After that just to say defuse this cancel.
[06:57] instead of checking of this request you can just replace it with message get sender a receiver all right why you are facing an error here I'm not sure
[07:25] cannot call a variable of type string as it is not a function yeah that's very obvious so we need to just remove this okay we need to call all this just hit save and see what I will have
[07:50] return too many ok we don't want to return too many just return the error right after we checking we are now grabbing this user schema next we start to define the sender and the receiver
[08:17] okay all we need to change is to make this message and just remove both of these this will be sender and this will be receiver all right what next
[08:42] here we don't want to return that we can just return that error ok sender is not found receiver is not found ok now we can just came up here change this to message this will be content we need to remove
[09:09] these both of them this will be sender this will be receiver all right next we can just remove this one and next we can change this to message or receiver this will be message
[09:38] ok now we need to update this as well just say msg this receiver msg sender
[10:08] and after all when you set of returning code this we can just return nl right and then we need to log log printf and we can just say message saved successfully
[10:36] from %s to %s and pass message sender message receiver alright and we can keep this one as the same we just now had save
[11:04] we need to go down here on send this ones need to be updated okay and i think that we also need to save the message even the receiver became updated so we want to change here is to say cm save message to db
[11:33] what we have here it won't just message so we need to remove all this and buzz the message directly copy this one and just say receiver not found on all of this and also return
[12:01] the error i need to redefine it i just add the column alright we're done with that just hit save okay i think we still need to update this and get friends alright how this works on the first place
[12:30] Connection manager has already, yeah, we should pass the song. Alright, we just go back here to get user friends, what if we make this sex? For example, let's save.
[12:54] Actually nothing will happen because this expected we should pass to a dysfunction of get user friends where we start to run the server. Right now I just go back to our friends.go package. We have got friends it expects the string.
[13:23] and the idea here that I believe that we need to write down this function, get following for our scrolling by ourselves. Okay, for that we need to remove this one and start to define that method here. Let's just say funk. Alright, let's just make it
[13:52] small case expect ctx which will be contacts not contacts user id will be a string
[14:17] final resort would be slice of string or array of string and error resolution alright next we need to come up here adjust return array of string of nothing and nil okay and start called up
[14:47] from here fix this to be a small pathway we need to call the contacts here what we can do is to go back to the manager go down down down down down down down down down down
[15:15] where are we yeah yeah just copy these lines and paste it here fix the indentation come over here okay before the user ID you need to pass this contacts alright we need to call this
[15:44] this will be updated by default okay after that as a matter of fact there is no need for this code anymore we can directly return this directly to our channel or pass it to our channel and return it as well
[16:14] we don't need to do anything different ok now let's just go to the server jrpc this is send message but this one forget following on followers so we can cut this or copy it close this for now and we can just
[16:44] based on that here. Okay, I just start Torque on dot 1 by 1, first follow need to add this. Next, indirectly remove this and ask if this user ID, if it is equal to error or not, I just hit save to allow all Torque, fine.
[17:09] Next to extracting the UID or user ID and say Here we try to find it and then say user not found if it not exist Then we create different this map
[17:38] start loop through friend's map id loop through the following and the followers ok and on this part we convert the demap to oslice and that's pretty it so we need to finally come up here say log prorentf
[18:07] can just say found we need to have this number so they present the difference for user, present test because it will pass this user ID so the length of friends will be the first parameter and then the user ID
[18:33] After all we can return this friends and null. All right next what we need to do is to start to create this chat server. All right we just start by add the package.
[18:57] and go to the real-time chart, open this okay we just copy all that we just copy all this and just paste it here okay now just came from the top remove this main main yep
[19:25] and even remove all these imports okay and we are going to call this instead of function mean start real time server and maybe we should export port and pass string to it
[19:52] All right, we have major state save, this one will give to us everything we need, okay, to the imported directory. All right, first of all we will say app use and then manager, new connection manager.
[20:21] here we didn't need to say real time we can directly call this function get user friends all right what next we need just to come up here down up lessen
[20:49] and just make this dynamic port so we can just say plus and pass in this port all right I don't know if we do have a problem here could not import missing metadata import because we don't need it actually
[21:18] ok the error error because we still don't need it we already on the same package so we can just hit save do we still use this real time yeah we still use here we just simply
[21:46] remove it and now let's save every error has been disappeared all right the last thing we need to do is to go to the cmd still that will go on error or docs no problem we will handle that
[22:10] Okay we just go to the make file and where this main we need just what clears to say cmd slash main.go. Okay next we need to rerun this. This has been created successfully.
[22:39] If we go up to main, everything is cool. Alright, now we need to add setup real chat. Setup a real timechat.go. All I can do is to copy all what we have here and just paste that here.
[23:09] go up here and store by say set up real time chat setting up real time chat okay this ones can be real time status okay status and
[23:38] We didn't need to do this, we just remove it. Ok, well we can say here, status active. Service. Service.
[24:03] can be something like a real time shot okay I think that's fine for that next here we need to say ws slash id
[24:32] And here we can, sorry this one here should be dynamic. Here we can grab this ID. What next? No new connection.
[24:59] I just have check I think we need to call manager as well we need to start to call the manager outside here so we can call this manager directly alright
[25:29] here we need to say real time new connection manager this needs the file the function real time get friends function okay we have this manager right now I think we need to come up here first and check if the manager is
[25:58] equal equal to 0 on that case we can just say log printf error well you can see here is connection manager is
[26:26] now for user and pass this id ok next we need to add the connection so i can say here is manager add connection user id and see next we need to come up here same manager
[26:56] remove connection pass the user ID as well and close okay here we need to handle the incoming messages so for that we need to come up and say handle incoming messages
[27:25] for msg real time message for spectral error 12 equal to read json pointer of this message and then check if error no equal to 0 on that case we want to say handle
[27:53] Do I have this function? I think we need to create that first. This is something like this one. Yeah, just copy it. I'm doing it the best here. Okay, now we need to document up here.
[28:23] and say handle socket error, password error and user id next we need to say manager remove the connection password user id
[28:52] and then we can just say close this C and we can break the loop on that case as well next we need to come up here and say log printf or receive a message from
[29:21] percent s to percent s and then another percent percent s we store by say MSG sender MSG receiver so from the sender to the receiver and the message itself so come back to a de-connect all right
[29:47] After all we need to send the message through the message so I can just say manager send to receiver and pass this message to it. Okay we think that's cool. Before we came out we can just came up here and say log println
[30:15] real time, chat, configure, successfully. Alright, let's just hit save, we still have an error. Not sure where we are here. User ID. Okay, the last thing we need to do on a backend is to start called this ones here.
[30:45] so they just came up here start here say set up real time chat and say set up real time chat pass the app to it head save right and actually we're cool what we can do now is very interesting when you can actually
[31:14] remove this server grbc we can remove this proto proto as well we can keep the rest alright we just try to run our app we just say go run cmd main
[31:43] cmd setup real time chat cmd setup real time notification what else we need to run setup bbi as well i don't sure if we need to call this or not just try to run it okay
[32:11] we need to press set up api as well so main.go cmd set up api right now just try to run it okay setting up api routes api routes configured successfully set up real-time chat
[32:38] real-time chat configure successfully set up a real-time notification all right that's great now I think everything is cool need to start test that just first go to this one and just check this out and we already passed the
[33:07] Port correctly. This one expect the up.
[33:34] I don't think that we need to use this anymore so I can just remove this chart server okay just check this out run this one more time okay everything now looks cool go back
[34:03] say localhost 5000 slash oh we are looking for here setup yeah setup realtime chat copy this one we just missed that here hit enter
[34:32] okay that looks fine status active real time chat all right i'm saying that's all i want to do on this lecture on the next lecture we can start this that on a front end with all i just move on directly to the next lecture
[34:50] you
