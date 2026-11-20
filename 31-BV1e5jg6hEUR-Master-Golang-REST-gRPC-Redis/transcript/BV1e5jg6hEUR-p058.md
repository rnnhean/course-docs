[00:00] hello and welcome on this lecture we will start dockerizing our real-time services and then add them to the github actions through our live cycle CI CD live cycle and finally we're gonna use them all via docker compose so this is mean that our app totally will run via docker compose
[00:29] very well let's just not waste the time go to the realtime chat and start create the docker file for it okay as a matter of fact we can copy this one and directly press dot here okay just make sure that we have the same no
[00:58] this is a different so just update the version all right next we'll actually going to replace this API with our directory name which will be a real time chat
[01:25] okay every single is the same just copy this dname okay we need to copy the name from here make sure that we have the correct name all right and then we would actually expose to the front
[01:54] two different ports for this is 8080 and 801000 actually we need only just one we want to expose this port which is for this real time
[02:23] but we don't need to expose any ports else related to gRPC or anything like that and actually that's it we can now save this and move to the real-time notification add dockerfile
[02:51] all right we can copy this one directly we start here okay well we need to change here is the first the version which is correct version okay
[03:19] we need to change the directory name just copy this best. here and what about the exposed ports we are running this gRPC on this port so just copy it
[03:48] i need to close all this go to the local file here expose.port expose another port and this one for the service grpc okay and the other port for
[04:15] the real time notification so just pass that here all right we're cool and we're done with that now we need to add this to our lifecycle specifically on Docker deployment here all right I just started by come up here
[04:41] and add the environment docker repo back repo a real-time notification or I don't know what should we call this let's say back chat for example
[05:09] here we can name this go up chat and think that's cool
[05:39] here we can say docker notify or just name it notification go app notification or notify anything
[06:08] all right i think that's cool let's just head save and here we need to double look at this this one is back end konang chat or real time chat okay
[06:32] this is not on the back end it is actually on real-time chat folder so we need to change this with that ok also we need to change this one with chat
[07:02] Didn't need to have this API or this one Okay, just have a look the name build become back and go long real-time chat run indocable Word file on real-time chat No, it is inside backend Slash real-time chat
[07:32] Just have a look at this back end, yeah, real time chart, docker file. Alright. Everything else is correct.
[07:58] after all we say docker push or this one alright that's cool just now duplicate this another time back angle angle time notification okay this is not on real-time chat directory it is on
[08:27] realtime notification so just copy this update this one alright now finally you need to change the repo name with the correct one
[08:51] all right cool now we can hit save and we need to go to the docker compose and come below this one start add the other services first one go lang chat service
[09:19] Okay, the image will be at, it is like this one. I just copy it. Directly paste that here. But, this one is not the same. This is, is this one. So, I need to replace the name of the repo. Go app chat. Alright.
[09:49] or next I think we need to change this a little bit or just leave it as this next add the container name, container name just copy it as well container name can be go, lang, chat
[10:18] service and I think the rest is the same so we can just copy from here and paste it here but the exposed ports is a little bit different let's just check that from here go to the back end, 12 time chat
[10:47] Dockerfile 8000 and 1 so we need to change this to be 8000 and 1 ok also we need to add debents on golang gbi server as well
[11:15] right now we need to add the last service here which is for the notification just have space change this to be in a state of being say chat
[11:40] we can say go lang, modify, service okay we need to have the container name or the name of the service finally going back here copy the repo name paste that here
[12:10] alright and it will take the same things but the ports are different here so I'll just duplicate this this one will be just select both of them and say 80, 80, 80 change this one as well 80, 90
[12:38] okay i think that's pretty it depends on golan give a server okay i think we're called here but there's another thing we need to do in order to make this to work is to use the containers
[13:05] names for calling the services to allow the services to call each other we cannot use localhost or anything like that we need to use the container names alright let's just start toward the backend on API on service here on the client we cannot use this one
[13:34] duplicate this, come up here take this out and we can say here something like dev-hops docker-compose usage all we can do here is to use the container name for it
[14:01] which is go lang notify service, just copy it, paste it here and we need to call this one here. Alright, we are done with dpi, all about real time chat. Okay, all we can do is to nearly the same, just look at this, take this out.
[14:30] came up down here so it develops docker compose okay what we need to do here just
[14:57] to copy this one as well take this out or remove it directly paste that here and we are actually need to use gorgon gbi service or container name close this thing here paste that here okay
[15:26] we just copy this one, duplicate that here and we are cool now we can head save I remember that we are on api.visus we are already dealing with that MongoDB container name okay the last thing is on frontend let us go to the frontend
[15:55] i think that we cannot we can deal with it like without change anything we can't deal with it as a local host so we run environment variable we didn't need to change anything but i think we need just to come up here and say on where the front end board
[16:23] just this on view server we need just to add another depends on go link chat service go link notify service and after all we can head save okay let's just this this we just say get all get commit
[16:52] section done i just want to let you know that this will be the last lecture on this section and after all we can just say origin rv pass the name of it okay now we need to go to rv
[17:20] This is not the correct one. Here it is. It tells us that we can make a compare. Portal quest create. Portal quest, please. Section done. He has confirmed the merging. Now we need to go through the actions. Okay, we have to run it on.
[17:50] i don't know i think we can cancel this one i'm just listening to this one okay let's just wait and see how we will have okay it looked like that we got an error i just discovered the error and see what is that
[18:17] okay the environment file is not found all right okay the problem was is actually that we was having these files here and we didn't have that file so we need to remove this one
[18:44] and remove this one as well and push and I'm making a commit I already did this okay and push that again and here we are running this one more time okay and I just wait and see what we'll have
[19:12] right it look like that everything is okay this has been deployed okay now I just go to the docker I'll remove the initial container I'll clean it up clean the images just clean all this say bleed volumes everything is set
[19:40] now we need to run our app via docker compose to just open up the terminal here and run docker compose up
[20:10] Ok, docker compose up. Just say hyphen d for detach this. Now it will pulling the images. Just wait until this finished. Alright, this is done. Everything is created. Just check that out. Looks like everything is works fine. Just check this. Go to the container.
[20:38] check everything, MongoDB, container, API service, the chat service, write hotels, notify, ok, and finally review service. Ok, it looks like that everything is offline.
[21:07] just go localhost all right now just start by creating your account head create account
[21:37] Create new account, yes. We don't have something that is not correct.
[22:03] all right i think that the error is related to the database. Exhaust request okay this is not working i just go back here to the containers view containers where that api
[22:28] I think the problem is related to the database we are not using the our internal database just check that out yes we are not using it this was the issue before we updated right now anyway the correct database is for use it our internal database will just mark this
[22:55] say devops have anything only to save this save this as well and only to update this v3
[23:24] okay just now go back okay we need to push this all right we need to now go wing to R-pository making a new podcast
[23:49] say new now compare to port of cost create port of cost and say merge port of cost confirm the merge then go to the actions okay we just cancel
[24:18] this one all right go and wait for this one meantime we need to go and open up this one just say local compose down okay this will stop continuous images
[24:47] okay the images we need to remove this one go api just hit remove go to the volumes select all volumes and delete them delete forever yep okay now we need to wait until the
[25:16] update is finished all right we are done with this and note that we remove the volumes remove the api now we can run the app one more time and see if this works say docker compose up this will pulling the barang api server
[25:45] to wait for it all right this is done now we need to run our app i just literally had on create new account okay this give us the result and the token which is mean that this is works fine now just login
[26:12] Head sign in, okay, cool. Just open this as ghost. Go to the authentication, say also, su s at s.com. Create account s at s.com.
[26:41] password 555 sign in okay now I just log for Ahmad okay head follow this should give us real-time notification yep it is totally works fine just go to this one think we need to refresh okay why this is doesn't work
[27:09] okay I think that this will work whenever we log out and log in again maybe we need to upgrade to update this when we upgrade our app let's just say log out okay
[27:38] it's fine go up here look for isle start following isle home okay so i got we got some things not right here okay refresh okay we need just to
[28:06] fix the cache thing this give us real-time notification okay we have a cache so need to refresh the page to clear the cache using ctrl-F5 okay we have all line out half test.hello
[28:32] write to go on message hello isle okay this is totally works fine hello again all right talk like that everything works fine except that we are actually need just
[29:02] to fix this image sync but anyway it look like that our app works fine till now we can fix these little things or when we stored actually upgrading our app let's just say a hundred first post nothing
[29:31] We need to pick an image. Okay, we can upload anything. Anything, anything. We also have that sample image. Hit create. Going back here. This will take time. Finally, give me Ahmed image. I just hit like.
[30:01] this will give me a real time notification sure all right I think that's all we need to do in this lecture what we can do now is to go to the main just saying it check out main
[30:27] say get pull all right we're cool that's all what we need to do on this lecture and on this section on the next section we will start do many things such as upgrading our app maybe using PWA and talk about distributed system etc so we just now move on to the next section see you on the next section
[30:54] Thank you.
