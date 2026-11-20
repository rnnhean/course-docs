[00:00] Hi and welcome. On this lecture we will start building our third endpoint which is forgetting user RDD messages and the main idea here that we want to be able to show the total number of RDD messages also the number of RDD messages between our main user and the other users very well meaning that we are actually for example here if we go to the yeah
[00:28] Our reading messages if we refresh the page, yeah As you can see here for example, we have main user here, which is for Ahmed All right, and we have this ones here By this way we want actually when we pass or search For getting our reading messages using this ID to get this record and this record
[00:58] and to get the number which is actually I mean yeah this record not that one not the first one this and this so we want to get these two records and get the total number which is 9 and 2 and 12 meaning total number is 12
[01:27] read-in messages and using the other user ID on a front-end part we can know from the the total read-in messages that coming from that specific other user ID or other ID other user all right you'll understand that very well on the front-end part but now we want simply when we pass
[01:56] main user ID to get these two records Because you have the same main user ID and also combine this number But I'll just start going Work on that Firstly we need to go here or routes and start to find this So below in this one we can just came and say app
[02:26] dot get slash chat slash get hyphen user hyphen unreaded message controller get user unreaded
[02:55] message okay cool now we can just copy this one and simply paste that here and let's just copy this endpoint path go to the top and paste that here
[03:25] all right finally we need to change the uh i should name so copy this one and going back here change this as well can now hit on civil all right and we can just start from here we can just say get get
[03:53] user run readed message I just combine all this yeah by this way you can just come here and say get unreaded messages count
[04:22] and records for user and on the description we can just put anything we can put them or else we have we have
[04:51] we just remove this one this one as well on param we can just have user ID it is going to hang through just user ID and this one will be an interface we just copy this one paste that one here
[05:21] this should be 200 okay after that we want to pulse the user ID from query so we want to get also the node this one just go to top again we want to get this one
[05:49] which is related to unreaded messages okay cool now let's just paste that here and go down here we can remove in this one in this one as well but here we want to say user ID which will equal to C
[06:16] dot query user id okay after that we can check if this user id is equal to empty string on that case we can send battery cost on a message we can just say
[06:45] we need to add curly presses here for authority map yeah, we need to add this ones here what is the problem? just remove all this
[07:11] okay now we can just skip here and say fiber.map message we can just say user id query param is record
[07:40] alright our call now we need to have a kind of filter we just got this, paste that here save filter where this menu is already
[08:09] is actually this user ID all right and as I read it is actually false okay that's cool now we can directly current from the database just remove all this
[08:35] start by change this to unreaded message schema pass the contacts and the filter just the filter who didn't need this one something to try fail to retrieve unreaded messages all right that's completely cool
[09:02] after that we can defer and close iterating over and build the array but simply we need to change this to urms okay this should be unreaded messages after that we want to define total
[09:32] on read on read message count which can be simply zero all right here you can just say u or m or read the message
[09:59] It should be a read-in message model URM Failed to decode the unread-in message All right, I believe that we are cool here But this part I just remove it
[10:28] rewrite it correctly I can just say if not if not what on URM.is3d yeah want to make sure that this is actually false no so we can just say URMS what happened with URM URM here
[10:56] belongs to this that we decoded not just that we want to say total our redid message count plus equal u r m dot num of our redid messages assemblers that all right i just remove all this came here say f the lens of
[11:26] your rms equal equal zero in that case your rms equal to array of models messages and leave it as it is all right and now we can just come here and say messages
[11:52] pass here urms the rdd messages then the total and here we can just say total rdd messages count very well now we can head save want to make sure that everything is okay everything is okay just go back here run this other documentation we have an error
[12:22] I believe that the problem is here we need just to remove this one save from this one more time right we didn't have any problem head air go back
[12:49] Alright, we can refresh this. We have this, get all the messages. Go back now. Copy this main user ID. Just hit on tryout, paste that here. Hit on execute.
[13:15] we have user ID card parameter is required all right if we go back here yeah if you notice this is actually not correct this should be equal equal now let's save
[13:43] Make sure that our application running successfully Going back now hit on execute As you can see this exactly what we want We got the records that related to this same menu ID I'll make it a bit bigger as you can see same menu ID and This 9 2 and the total is 12
[14:11] where all this is exactly what I want we can use it with the other one or test it just go back we have this one which is ISO go back paste that here and then execute I've copied twice actually just copy this one go back here head paste execute as you can see
[14:41] Did you call that related to Isle? Looks like that everything works fine. We can now move on to the next lecture.
[14:49] you
