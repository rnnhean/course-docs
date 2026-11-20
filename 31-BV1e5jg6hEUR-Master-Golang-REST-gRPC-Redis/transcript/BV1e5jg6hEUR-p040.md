[00:00] hello and welcome on this lecture we will start working on the GRBC server for API and if you remember on the last lecture what we need right now is to be able to send a GRBC request to our API with our user ID and receiving a response with the user friends
[00:28] Which will include the friends IDs So just to start work on that open up API and The first thing that we need to do. I think we need to start create a new file we can call a protos Okay, and inside this file, I just create the proto file for that one
[00:58] since that we will use we will need to create two we can call it them we will need to create two different functions one for sending the message and one for receiving the message all will be related to chat so we can call this chat.proto all right now I just start by building this we can just
[01:26] by coming up here say syntax is proto 3 I think we need to add an extension to be helping us we can call it gRPC
[01:55] jrbc clicker i'm not sure directly from vscore call jrbc server okay but i didn't need this went to auto buffs
[02:23] I think this may be useful due to us the public services let's install it in a way I think this also may be useful
[02:50] all right let me just let this installed while we are working on that okay okay it's look good
[03:13] after that we can say option go package equal to slash produce all right we specified place
[03:38] of this after that we can define the service we can call the service real time chat service the first one for it will be your PC will be get user
[04:05] following followers we'll expect user id where it turns user id is
[04:34] list a response of course we need to create this okay second our pc is send message we'll expect message request
[05:02] message request and returns user or message response all right now we need to start work on that let's just start by the message
[05:28] and first thing is message request we have the first parameter is string content one adjust duplicate this after the content we need to define the sender this parameter
[05:57] It refined this tool. After the sender, we need the receiver. I can only fix this, I think, and I just fix it anyway. Re-ceiver.
[06:24] and this one is three okay after that we need to define message the message response just string of message this will be number one okay after that we need to define the user ID
[06:52] user ID is list okay just talk on that message user ID will be string of user ID which will equal on okay note that this this number is here refers to the place of the of the parameter is itself okay
[07:21] Of course this is how a proto file works. After user ID, something is not right. This should be your capital. Just fix this. Get user ID. After user ID, we need to define users.
[07:51] ID list response this one and this actually can be will not be just one it will be a list of the user ID list itself so what we can do is to come up here down here and store define another one
[08:20] call it message user ID's list okay this would be repeated string of user ID user code user ID's list okay this will equals to 1
[08:48] and after that we can come up here say repeated user ID list of user ID list but this one will be list this which will equal on
[09:17] all right we need to of course to close this by this way also this one by this way we can define or let our prototype and GRBC system understand that we have a repeated string will be this would be the response here we just change this to make it user so it is
[09:46] less response and change that one here as well user ID is less less response okay I think we are good here okay we just save this and now we need to build this okay oh the matter of fact we need
[10:13] to start firstly by install a package we can just say go and install google.org slash protopuff
[10:38] slash cmd slash proto c gen go at latest okay i just had to enter okay this is not the correct one
[11:08] We got this give us this not found Yeah, I think this is the problem over there. This is not the get this is Jen We just now head to enter Okay, we got something right
[11:34] okay we just check that out we can search about this but I think I already remember this yeah this we should start by say google.goolang.org slash protopuff slash cmd slash autos we just test this wait until this is the loading app it look like to work fine
[12:03] just wait until the download is finished okay great now we can use it to generate the files for us for that we can just say protoc hyphen hyphen go underscore out equal dot hyphen hyphen go
[12:33] slash or hifn grpc underscore out equal dot or period protos slash chat dot proto
[13:00] Okay, let me just hit enter. Some things not right, Pro to C. Don't need to use get. Get.
[13:22] patch instead of using the terminal just test it anyway see if whether this work or not okay this protoc not turned okay i think that that i need to run or install broto compiler which we can found it here
[13:50] protobuf compiler releases will be on gethub.com, protobuf buffers, protobuf releases can go through this link yeah this are looking for and search for windows where this windows
[14:18] 64, hold on, just leave this on the scope, head save. We got this one. Okay.
[14:44] the beam all right okay this protocol before global data instructions this package contain probably off of off compiler this binary is intent for users okay
[15:13] okay now we need just to add the store environment variable just go to the thispc all right go and see we do need to create a file i think we need and i just call it protos see
[15:39] Okay, now we need to extract this one here. We just extract foil, say okay. We can cut this based on this here, okay.
[16:06] now we need to add this to the environment variables ok, we can now hit command s or we can simply come up here and say environment variables edit system environment variables, yes
[16:34] environment variables here we can head on system variables here we can head edit we can add new
[17:04] or actually not this place we need to come up on pass on system variables then hit edit then add new and we can add this one c proto c slash beam after that okay after that okay and we can hit on okay okay now what if we test this protoc version
[17:32] still not found what if we close this one we need to go back to our app we just try to open this one more time alright it look like that this one is work we have brought to see with this label ok
[18:00] Everything is installed correctly. Now what? We can just hit our command Pro to C, if nothing go out, period, if nothing go RPC out, period. So this will give us everything inside this one. Alright, let's just hit enter again.
[18:23] courtesy is not recognized as an internal or external one failed was the status called on I think that is mean that we need to install another package it's related to this gen go gRPC which will be this one actually
[18:46] can just now head to go, install google go lang.org slash rpc slash md slash pro to see gen go rpc latest okay let's just hit enter wait until the installation is finished now we have pro to see go gen
[19:16] which was the problem if you look at this tells us Pro2c.jn.go.grpc is not recognized as an internal external now after we did install it can we run our command once again? actually yes now this has been created in chat.pop chat.grpc.pop.go all right
[19:45] Everything is cool. Don't know about the earth not happening here. It is totally UK. We can now go back, say, go mod.toy.enters.
[20:10] all right it is installing everything that we need such as reflect protopuf reflect all the other things that we need to run our gRPC correctly all right okay everything has been installed everything we need has been installed we didn't have any errors right now and we are ready to use our proto files
[20:39] now this will generate for us all the functions and the methods that we need to use as you can see here we have this user ID something like that we have user ID lists everything we described now this has been created for us we can now use it very easily
[21:02] and we just start to work on that on the next lecture, so see you on the next lecture.
