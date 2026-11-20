[00:00] welcome back my dear student on this lecture we will start work on the real-time notification right first thing first we need to start create a new folder inside backend we can call this real-time notification
[00:23] all right now we need to go inside of this real-time notification and simply open up no not this one here real-time notification and we can open window terminal and if you are using cmd we can just hit cmd then hit enter as you want
[00:50] or i'm not sure if you can use kpash but anyway you can also use partial all right then now we need to start initialize the go app we can say go mod init real time notification
[01:18] all right this will create us this one and as we saw on the previous lecture on the diagram we're gonna use the gRPC to be to receive the the order or the notification and then send it via a web socket to the user for that we just start by creating the protos file
[01:48] Alright, we can call this notification.proto and start working on that. First we say that the syntax is equal to proto3.
[02:17] okay next we need to add the go package and just say option go package will equal to slash proto
[02:44] ok now we are allowing this to create when we start creating the popup files using protoc to have go package of the same name of the folder that we have ok next after defining the go package we need to import two things from google protopuff empty and timestamp
[03:14] and just solve by say import import google slash protopuff slash empty dot proto we need to duplicate this
[03:43] but this one will be time stamp all right because if you if you remember why this look like the front just remove this one I think we need to add a semicolon here
[04:11] this empty okay is unused okay if you remember on the i just go back here on api where is the notification model if you note this you'll see now we got this one created at which is time
[04:39] Ok, and then I just start by defining the service which we can call it notification
[04:58] and we do only actually have one service on RPC which is for send grpc notification which will take notification
[05:28] grpc request of course we didn't create this yet we're going to create it on a second and this returns we didn't want to return anything after creating this after calling this to the api if you remember we will expect
[05:57] at the request from the API whenever our API starts to create a new notification but we didn't know to return anything so that's why we're gonna use Google Pro2Path empty
[06:25] Note that this one is actually a capital but this one is a small. This is how this will look. Right after that we just define the message of this notification gRPC request.
[06:47] first we have string of underscore id which will equal to one string of details which will equal to two we need to close this by adding a semicolon string of
[07:16] main UID which will equal to 3 string of target ID which will equal 4 after that polyon ball of is redded
[07:44] which will equal to 5. After that we will have a google
[08:11] and the name of it is created at and the number of this is 6 alright next we have finally the user which can be user we can call it user
[08:37] grpc which is a type that it does not exist but we're going to create it on a second can come up here say that we have a message user grpc has two things string of name equals to one sorry add the semicolon string
[09:05] off avatar and this is for B2 this give us an error because we forgot to add a semicolon here if we hit save now everything
[09:34] looks fine close this one now we can create this protopuff for go we can simply store by say protocy hyphen hyphen go underscore out
[10:02] period hyphen hyphen go dash I want to make this a little bit bigger go dash G okay look like this is so bad I just make this a little bit bigger start by say proto C hyphen hyphen go
[10:31] under score out equals to 0 period i'm sorry hyphen hyphen go g r p c under score out equals to 0 to period and now we can specify the place protos slash
[10:57] notification.proto okay they just hit enter great this has been created for us now to be able to use this we need to say go mode tidy
[11:21] wait until the download is finished alright it looks like that everything is cool now we can start work on gRPC
[11:36] the real time on the next lecture. Let's just move on to the next lecture.
