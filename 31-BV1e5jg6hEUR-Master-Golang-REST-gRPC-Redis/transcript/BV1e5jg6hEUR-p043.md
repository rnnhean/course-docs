[00:00] hello and welcome on this lecture we will start using our gRPC methods here on real-time remember that we are simulating that we are getting the user friends right here also we are trying or we have to do here on sending message to save it via gRPC ok to be able to use this
[00:28] API GRBC we need first to have the same proto file so we need to copy this one and then going back or real time create new file it doesn't need to have the same name but I prefer to give it the same name
[00:54] to be convenient okay after all we should save that here right we have now protos side of it chat.popup okay we didn't need this one okay let's just remove it go to the backend api protos
[01:20] we are looking for shad.proto this one all right just copy and simply paste it here okay cool now to be able to use it here will be this one will be actually just a declined okay
[01:47] now to be able to use it we need to head to open the terminal or cmd or anything that use we need to head the same command protoc--out.period-charpcout period protos-chat.proto
[02:12] and after all hit save or actually hit enter after all after this create the files for us we will need to hit go mod tidy alright wait until the illustration is finished and after that what we can do
[02:41] we can actually create comma up here remember that we are now inside the real time we need to create a new folder for a new package and just call it serve grpc
[03:06] okay inside that we can create a new one we can call a client grpc.go okay they just stored by defining the package
[03:29] and after that i just store by creating the grpc client for getfollowers client all right i just store by sayfunk getfollowers or following or we can name it friends anything
[03:58] we expect ID which will be a string the response will be a array of photos user ID list
[04:27] and errors ok we need to have practice here right this is the function signature after that we need to have the connection uroy we can just say con and error
[04:55] we want to have a connection with grpc dot here we add the target it should be we can directly use the port which should be 5001
[05:22] and then grpc what transport credentials instance or sorry insecure new credentials okay
[05:50] because till now we didn't have any credentials to use gRPC if you check up this one this tells us that gRPCDL is deprecated using your client instead all right this one give us the same thing
[06:19] after that we need to check f error not equal to 0 on that case we want to log dot fatal f say did not connected pass the error okay
[06:47] return nil and err. After that we want to say defiercon.close. We want to close this connection after we did this. After that we can just say client on equal to prutos.new realtime.
[07:16] child service client say con note that we are getting that name this will be created by default whenever we run the command you can find it here and how can you know the name of it it will be related to this one so on the first one we have service
[07:45] realtime chat service server but this one is client and both of them has been created on these files if you go back here you'll see that we have this somewhere we're actually calling this I think on main this one we register realtime chat service server
[08:15] now we didn't need to register this we just call it declined okay after that after we call declined sorry now we need to call grpc method we can just store by add contacts ctx only equal to contacts
[08:45] dot background the cost will be equal to pointer of protos protos user id this one and here we can define this by saying user id is equal to this id that we are expecting here
[09:11] next we can put the response and the error on a variable while we are calling this client get following follows and pass the contacts and pass the request after that we can check for error if error not equal to 0
[09:36] on that case we can just say log.printf error with calling getUserFollowWars.jrpc personv and pass the errors ok after all return nil
[10:06] and the error all right after all we can return response dot getUserFindIsLest and on error part we can return nil
[10:28] okay great now what about the other one which is for sending the message we do need to actually copy all this one so we can copy and start create the function here func send message call it client sender this will expect
[10:57] send the receiver and content okay send the receiver content pass the string expect just an error okay and add all these things
[11:21] okay why do we have this ones here because we are actually return only the error so everything here until this point is the same after that defining the client by the same way so you can simply copy this one
[11:49] and paste it here and after that the contacts also will be nearly the same and then at the request, the request will be different pointer of protos
[12:17] dot message request okay now we can say the sender is equal to the sender receiver or equal to receiver content or equal to the content that we expected on a parameters
[12:45] right here we can ignore this and have the error equal to client send the message pass the contacts and the request after all check if error not equal to nil on that case log fatal or printf
[13:13] error while calling send message grpc person v and pass the error and at the same time sorry return the error and after all return
[13:42] now now we are ready we need now to start use them and where exactly we can do this we just start by saving the message close all this go to real time
[14:05] on a real time manager here on to do we need to save the message okay we didn't need this to do after now okay we can just start here by say error this error we didn't need to redefine it already defined the variable here server gr server
[14:34] then send message client msg dot sender expect sender so msg dot receiver msg dot content we're good after all we can check if error not equal to new
[15:02] on that case we can just say log.fatalf error saving message to grpc %s %hv msg can pass the receiver and error
[15:32] we're all done with this now what about getting the user fans okay here we need to actually start to convert the response to fetch our application so
[15:57] what we can do is to go to these friends and copy this one we can ignore this one they just start from here I think we can keep this one I think we can keep many of these things
[16:25] we want it to be work or the same way so we have the same function signatures where this pass the user ID and expect a channel include string or list of strings of user IDs okay so what we can do
[16:52] we can just came up here say defer close this channel okay this is the first thing we already have something like that here after that we can call jrbc client function okay we can just say user friends an error
[17:22] server or serve grpc the package name dot get user following and followers client pass the user id toy and check if error not equal to nil on that keys want to see fmt println something like
[17:51] error on friends method something like that then say channel will have empty string
[18:17] and after all this should return now we need to to convert the user friends to a desired format for that we can just say war friends array of string we can say force underscore
[18:46] user id is last we want to range on this user friends and after all say friends only call friends to user id is last user id is last
[19:16] a slice of this user it is just yep exactly this what we want to have after all we can say channel goes to we want to pass this friends to this channel and finally return this channel all right we are ready now we can use or go up here
[19:43] okay to be able to use it we need to go to the backend API open this one we need to run our app go run min.go also we need to run our app here for real time
[20:10] go around main.go okay and we need to go up here we can just say where is that we need to refresh this
[20:35] just hit on refresh everything has been updated okay note that we didn't have any message we didn't have any already did user message we have this user over there which is Ahmad okay we know that this should return to us too note that we will not deal on a front-end part we will not deal with gRPC sync we will dealing only with
[21:03] front end so what we want to do is to go to WS localhost it doesn't know WS slash and here the Ahmed ID I just set on connect need to duplicate this copy and paste that one here and now what we want to do is to get this one which is for ISO
[21:31] going back to postman paste this and now hit on contact connect as you can see this give us online friends this one which is for Ahmed and this will update Ahmed with ISOID alright this is mean that it is the GRBZ works perfectly
[22:00] If you came up here, I don't know if you'll have a Message or not. No, I didn't have got any message, but the idea here that this get the user IDs correctly I Don't know if we have this Nemo or not, but we just test it We need to copy this one
[22:26] paste that again sorry we need to copy this one paste that here after all we need to copy the NIMO ID paste that here head to connect all right let's give us the both of them IDs which is mean that this should update
[22:55] isle and update Ahmed about the name of connection so the first GRBC client work perfectly now we need to look for the second one I just say okay we can clear up this one but we want to create or send a message to test this sender all right
[23:24] as you can see we pass the sender receiver ID the sender can be Ahmed okay I want to check right now is all this save the message or not okay the ID this the receiver can be ISO and note that this is kind of Skype here okay but it is not
[23:54] the the case with the proto file but we are actually dealing with this yeah okay so this should work with that because we are fixing it
[24:17] by say by name it by this name this doesn't make any difference if we just call this or and this or the important is the correct order all right now let's just go back to the postman okay can call this first real time saved mhg from Ahmed
[24:46] to iso okay now just first to check the messages head to refresh nothing and there are real messages still nothing cool we need also to clear the messages to iso and start try to send this okay talk like this has been sent
[25:14] and received here for ISO of course this will not receive anything except the online users ok this sends nothing this send an empty we didn't need to send it anyway now if we go back here a refresh as you can see this is has been updated on messages refresh create this has been created
[25:43] so what that mean it is mean that everything works fine it is mean that the real time chat or line with the correct data users is works fine let me just call this second and send another one check that out of course this will update ISO as well
[26:08] it tells us second real time saving messages okay and this will update here will update already in our read messages this now begin to and it look like that everything works fine so depending on all this I think we're cool here we're done with this so
[26:34] we just close this one just close everything ok close this one alright we we need to close everything and go back now get this ones here and what we want to do now is say gut at all gut
[27:04] get commit we need to commit this or yeah we need to commit this we can just say real time chart done and finally we need to push this
[27:30] get push origin real time chat alright, we need to come up here head compare and pull request please create pull request this checking the ability to auto merging
[28:00] at merge we're now merging this with this node this will fire up the actions twice actually one for push and hold for pull request but after all we can say get checkout main and we need to update our main branch get pull
[28:29] all right now on main branch we go at this one real-time chat all right everything has been updated okay so what I can do now is to create a new branch and call it real-time notification
[28:58] okay and we can start work on that from the next lecture so see you on the next lecture
[29:07] you
