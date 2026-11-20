[00:00] hello and welcome on this lecture we are going to use a notification gRPC here on API all right first of all we need to have the proto file and gRPC file we need to build it for that we need to go through notification rotos
[00:27] and copy that file note that we should have the exact same file structure so we can have a kind of chaired file between the services or servers or to have the same exact copy of the proto files okay
[00:54] after that we need to build this via protoc so we can just put that command here protoc hyphen hyphen go underscore out period hyphen hyphen which rbc out slash protos notification loop proto all right let's just hit enter okay this has been created for us
[01:22] and now we need to go inside up here grpc you need to have a new one let's just call it client grpc.gov okay let's just say that we have a package server or serve
[01:51] What do you call this? So I will just directly copy this from here and paste it here, okay? All right, then we need to define the type of the client Which will be struct first argument will be the con which will be
[02:19] a pointer of grpc.clientConnection or con and the client itself which should be protus.notificationServerClientServiceClient
[02:45] notification jrpc service client all right then we need to have a new function here for creating the client we can just say func new client which should have parameter of pointer of this client and error
[03:12] this is the response of this okay after that we need to come over here and say con or connection and error or goes to grpc new client the target can be port as already dead 80 90
[03:41] okay for that we can use gRPC with transport credential and secure not new credentials
[04:08] all right after that we can check if the error does not equal to nil on that case we can return nil and the error next we can now return a pointer of this client with connection actually equal to the connection
[04:37] and the client which will be protos new notification client exactly which will include this connection after all we can return the second parameter of null for the error okay next we can come up here and say func
[05:07] we can have this receiver for client to create close function so we can just say c client close c.con sorry we need to add nccr.con.close
[05:35] not connect close all right finally we can now start override the method and also have another one to be able to use it we can just come up here and say funk see pointer of the client
[06:03] send grpc notification and just go back here on protos, notification protos, only to use the same name, go back, pass this one, just pass this
[06:27] and now we need to expect ctx which will be contacts dot contacts xid or id the sorry details main view
[06:57] oid target oid all of them will be string as every dead which will be pulleon and finally we need to add created art
[07:27] which will be time time next user name user name user avatar both of them will be string
[07:54] and this symbol function will return an error or null of course now here we need to prepare the requests we just said a comment prepare the request we can just say that we have requests variable request
[08:23] watch will make a pointer of this process notification jrbc request xid will equal to this xid details will equal to this details
[08:49] main user id equal to main user id next target id equal to target id is rated equal to this is rated now for the created art created art we can use pointer of time stamp
[09:19] dot time stamp and define here seconds and say created earth
[09:48] dot can we go back here no we need to use this one so let's just copy this one paste it here created R dot UNIX
[10:10] okay that's cool finally we need to say that the user will be pointer of protos.user.grpc the name
[10:35] will be user name and the avatar will be user avatar
[11:03] right yet all we can do now with this request is to call the grpc client function say underscore error and as a matter of fact we need to call it first we need to create it we'll just go and create it before because
[11:33] we can't call it why this way the main purpose for this is to allowing user to allow us to simply send the request by that sample way then prepare it then call the function that we are going to create right now which is function we can call it send notification
[11:58] which will have notification models dot notification will return an error now we can come up here say client an error both of those two new client if error
[12:26] not equal to new on that case I want to say log.printf fatal or sorry failed to create your pc client %v and pass the errors
[12:54] and after all we can return an error okay after that we can say the fear client close after that we can define the CTX or the contacts contacts background next say error 1 goes to
[13:20] client send grbc notification next ctx notification dot id hex
[13:48] okay this is the first we pass the contacts the next the ID then notification dot details notification dot main new ID
[14:17] Next Notification.TorgetId Next
[14:47] After notification target ID, all we want is notification as reddit No
[15:10] I feel there is something right here. We will discover it soon.
[15:38] after that we pass the notification dot create it out now this capital C and this one I'm sure that it is like this is rated
[16:04] This created a next notification.user.name Finally notification.user.
[16:34] Okay, that's pretty it. We just have it on by this way.
[16:57] all right next we can now come up here on the next line and say f error not equal to 0
[17:26] on.case we can come up here, say log.printf fail to send notification person v
[17:54] error and return the error if everything is okay just return the error great now we can save this and now go back to the first function come up here say under score error and then c.client.send
[18:23] grpc notification ctx and request checkf error not equal to 0.case log printf failed
[18:50] to send node you thinkation person v and the error after all we can sorry we can return the error and that's pretty good now we can hit save look like that there is something is not correct here I'm not sure
[19:20] oh i can just say go to tidy okay and it looks like that was an error here i just fixed one by one main user ID target ID, target ID created that
[19:49] avatar t yeah I remember this we are using avatar t okay great now we can use both of them we are ready now to use our new client or you our new gRPC client for calling the notification sending the notification
[20:13] Okay, we'll just now start using it on the next lecture.
[20:19] Thank you.
