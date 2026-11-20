[00:00] hello and welcome on this lecture we will start create and run the gRPC server we will start create our first RPC or method which is related to get user following and followers alright first of all let's just come up here and let's just create a new package you just do this on a specific package we can call it server
[00:29] Or we can name it directly GRPC, but this one make us confused. So we just keep it as with just name. After that, server grpc.co. Simple as that, of course. We should store it by the package.
[00:58] server grpc okay and first thing here that we need to add struct here include the unimplemented real-time chat server server okay you will understand what i mean let me just say type the type of the server himself would be a struct
[01:27] had pp this will be represented for the prototype so I can just say import pp which will be for server what's going on we named this okay we named it server so what is the problem
[01:54] server slash protoss now this is unusable we're gonna use it now right now PEP dot unimplemented server and we can actually check this one you'll see that this gave us the methods
[02:20] and all this sync as you can see this tells us that this showed in general pointer differences when methods are called great now let's just create our function we can just say we have a function
[02:45] the receiver of it would be the server and the function we can call it getUserFollowingFollowers Note that we should keep the same name CTX contacts
[03:15] all right the request will be pointer of this pp user ID okay now the response sorry how this this contacts contacts dot contacts dot contacts
[03:42] all right the response would be this pointer of this pp.user id is this response and there should
[04:05] So this will nearly make kind of overwriting, so we should have the same name of the same muscle. We define it on Protoss, okay? Now, we should, so we can start by defining the user schema, which would equal to dataBs.db.
[04:34] collection specifically users collection okay users ID can be from request dot get user ID okay if user ID is equal equal to new or empty string actually return
[05:03] now as well as fmt errors f user id is required all right below this one we need to start define the user model so we can just save our user
[05:33] models.userModel.uid underscore primitive object.id of fromHex.pastoid.thisUserId
[05:59] all right now we can find this our user share goes to user schema find one ctxpeson.dem underscore id uid
[06:25] if that the case we want to decode this user F error not equal to nil on that case we want to return nil fmt error f user not found okay or else
[06:52] after that we want to create kind of friends map and I think we can use dynamic programming to do this so let's just say friends map which will equal we want to make map of string
[07:19] and pull it. For under score and the ID on this range range on user not following
[07:48] we want to say friends map ID equal to true okay now let's just duplicate this one because the idea that we want to return an ionic list meaning if our user which is user number one has on his following list
[08:18] and on followers list same id meaning that he and that friend are following each other we want at the end to return just this one once so simply we are making a unique list of user following on followers
[08:42] assembles that so we can now change this to floors okay for that we can save more friends we list our strength for id
[09:07] range on this friend map friends will append this friends on the id assembles. Now we can return this list
[09:35] simply by the three members that we have a specific prototype that we need to return we have a specific type which is this one that we need to return we should return it was a specific way we should say return a pointer of this pp.userID list response exactly
[10:00] we should now define user id's list it should be a slice of pp.users list inside of it we should have user user id's list and here we can pass this friends
[10:29] we should add a comma here it looks like there is something neutral yeah yeah that because we need to add a comma here and simply add null cause this expecting from us to return an error since that there is no error so we can return null that's great now you can save this one go back to chat
[10:57] and actually we need to now run this server jrpc for that we need to go to the main and then
[11:24] here below this one just add a comment set up grpcserver and set up grpcserver alright first thing is
[11:51] to listen on specific port so we can just say less an error here we can use net.lesson specify the type which would be TCP type of the network
[12:17] and the other is what it called the port will be 5000 and on all right this is the first thing we need after that we can simply check if we found an error if it error not equal to new I can just say look fatal fatal
[12:44] no no no no sorry sorry sorry fatal f field to listen percentage V and pass here all right this is the first one after that we want to have grbc your server we can call it g
[13:14] RPC server will equal to gRPC now that this will automatically include this one or imported okay what we want to have we want to have new server
[13:38] all right this expect us to pass to a specific one we will work on that simply by say pp but i think we need to call this again so we can simply copy this one paste it here all right what we want to do we can use registers
[14:07] it will always be named will be a register and after that the service name if you go back here you'll see that the service name realtime chat service so now we can say dot register realtime chat service server all right after that pasto edg or pc server as the first parameter second one
[14:36] pointer of server grpc this will be imported directly dot server but actually I think we need to call these ones here they just work on that we didn't create it yet
[14:58] and the idea here that we want to be able to run the server with specific way we can use all these ones here actually since that we call it already here so no need to write this down here by another word we can actually do the rest of the work here
[15:28] or start write all this data on a function here but this I don't think that this very useful so I just complete this ones here after that we want to be able to use something like we want to use something like postman to test this and do too many things so I want to register this with the reflection
[15:57] Do I need to install this reflection? I'm not sure. Let me just store it here. We can use goget.google.com
[16:24] golang.org.grpc flash reflection okay now we can just hit enter okay now we should be able to import this reflection
[16:53] Wow, we can't do this. Let's show yours. I just came up here. Look at this. Slash reflection.
[17:22] okay why we can't import this we already can so there is no errors rate after that we can just say not register grpc server assemble as that after all we can log printlin
[17:50] something like grp grpc server running on port 5000 and on okay
[18:15] and as a matter of fact we should use goRoutine to call this so we can come up here say gofunk f error goes to grpcservers.serve
[18:42] less error not equal to 0 on that key's log fatal f field to serve percentage v and the error right we need to call this one, add this one here
[19:11] that's great we are now ready let's just try to run our app we'll just say go run main.go all right let's just head on allow access and now we need to go to the we need to go
[19:39] open this one postman say in U define this GRPC we need to select this which will be GRPC local host 5000
[20:08] and on and now we need to import protofile can come up here import protofile go to the desktop where is that realtime backend, api, protos, chat.broto
[20:36] we need to add this pass as well yeah we can select this ok we can select this one we think by this way need to refresh all right we are able now to use this get user following colors note that
[21:06] this one is here not implemented yet this and message not implemented yet we can use example message this directly give us user ID okay if we invoke this now this should give us user ID not found or user not found okay they just start by remove this one and pass an M key okay as you can see the error here tells us
[21:34] userID is required it's same message that we are passing it from here userID is required all right but if we send something it's not exist hit invoke this should give us another error just like userID not exist or anything like that anyway
[22:03] We need to come up here on AhmedPlug.org. We have three friends. This may give us two at the end. If one of them is duplicated, let's just check that out. Okay, we have one duplicated. This should give us two at the end. We need to copy this ID going back right now. Give us, as you can see, user not found. Okay.
[22:31] look like to work fine turn now now if everything works fine this will give us list of two IDs head invoke wait until this is finished invoking the method okay this keep give us user not found
[22:59] that's so weird let me just go back and check it out here is the angry boss user not found okay as a matter of fact I think that the error is related to the database because we didn't update the MongoEoRoy we need to update it to work with this one I just
[23:26] close our app here on this one more time okay everything is cool going back here now just press on correct one remove this A hit invoke this will directly give us one second we just add this E now this should give a return to us a list of two IDs
[23:56] great as you can see here we have we have user id's list and inside of it we have these two id's why because we are using it dynamic programming here just close this one right now okay for returning a unique list very well it look like that everything works fine on the next lecture
[24:24] we can start invoke or actually implement the other function for send message it will be actually for saving message but we already named send message but the main purpose of this will be saving message to the database so we can start to implement it on the next lecture so see you on the next lecture
[24:50] Thank you.
