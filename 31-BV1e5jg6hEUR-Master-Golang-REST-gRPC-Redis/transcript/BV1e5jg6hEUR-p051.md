[00:00] hello and welcome on this lecture we will start running our application we will start to use the real-time notification first thing that we need to do actually is to connect to the notification we need to call this one and we want to make sure whoever we close this to be to unconnected
[00:27] close the component or the app okay so what we can do is to come up here on app.view all right and here are methods we need to add this method below this set data we just add a new one
[00:55] and this new one it called connect to notify just copy it and paste it here call here shall mounted we want to say this connect to notify and just call it
[01:25] and we need to add another life cycle which is called before unmount and here we need to add close or stop connection notify
[01:51] which need to be declared here so I can just here say this stop connection to modify all right is this everything actually no just imagine that we start now and this just open our file this life cycle will be called which is connected to notify meanwhile maybe we are not
[02:21] logged in yet and to be able to connect to real-time notification you need to be logged in so this will not work it will not accept this connection since that we are checking or locking for this one which is represent the user login data
[02:44] so what if our user now decided to start again actually this one will not work he will not be connected to the realtime notify service so this is not to work perfectly what we need to do is to go to the views
[03:10] and looking for login and register and then we can start here where on the successful board we need to start with the CNI okay what we're looking for is okay I have something is not right here on view
[03:38] which already add this to the map mutations which is not correct I just cut both of them this should be on map actions so I need to come up here sorry map actions this created for us directly
[04:08] and here on map actions we can start add them of course we need to add a comma here now on osfo we are looking for is map actions we need to start add both of them as well
[04:38] or actually we need to adjust one of them which is connect to notify right or else okay negative positive it is here from the sport
[05:03] before we change the route we need to come up here and say this oops this connect to notify not only here on the register login I can do the same here on the register on positive
[05:30] we can pass this and disconnect to notify all right what what if our user decided to disconnect in that case we need to go to navvore looking for logout logout yes this is a map action
[05:59] sorry we need to add this one just go back, connection, stop, notify going here, add stop notify where this log user out can just say this
[06:29] stop connection to notify all right this is all the cases now we can start use this on nav4 what we can do here is actually very simple we can just watch the changes on map state and just increment the number of notification number by one
[06:58] so we can just come where we can do this on computed below the computed on computed we need to add another one map state
[07:26] we are looking for real-time notification or real-time notify go back keep this here below this one we can add watch
[07:54] all right here we can look for real time notify specifically we want to check this one I think we do update this
[08:19] on message notify add notification when this add notification called this number is updates so we can just paste that here let's say async function
[08:44] Do we need to make this an async? I'm not sure. You can simply say this. What do you call this? Notification number, okay. This notification number equal to this notification number.
[09:12] plus one all right that's nearly pretty it now we need to start test it our backend is running we need to go to the front end we need to run this just say here run surf
[09:41] Okay, this run on port 80 and I just opened it. We need to look up for how it happened here. Seems nothing, till now go to the authentication, try to login as Ahmed.
[10:09] I am now logged in, if you will look at this, you will see that we have user, Ahmad connected. We just now open this as a ghost, go to localhost, we need to log in as ISO.
[10:37] okay this will give us that we are logged in we are connected okay now we have ahma post what if i should start love this post this will affect on anything
[11:04] we have sending notification to user okay we need now to go back to check this as you can see this has been updated here that's great right this doesn't disappear but it look like that it is it is works anyway we will check up in this later on I think for now
[11:34] Adjust this on again, just put them on a small part. Now this at the left and this at the right, just say a new comment.
[12:04] try to add this comment as you can see directly this has been updated this will never be changed unless we refresh this all right we will see how to fix this later on but for now it looks like that everything is okay but you know we can make something really beautiful
[12:33] instead of do it by this way why because it is already what we are doing right here so what we can do is to put this on a function and then call it on mount this is on mount okay let's just
[12:59] Added home methods, what we can call this Unreaded notify count Can we add all this, get short message, no one here, we are caring only about this port
[13:29] can we put this here for await we need to add this async and simply we can copy this one and we can just call this here okay let's just test that
[13:58] need to refresh or refresh this refresh this and start we need to start now to add like for this post okay this has been updated what if we come up here
[14:26] and then going back this doesn't fixed okay we will deal with that on the next lectures and also we'll see how can we get the real time notification updates here because till now if you go back not comment any hit add as you can see this should be updated this
[14:56] but it will not update this one ok, I think also that this one wasn't updated no, this is updated why if we are stopping here refresh add another comment
[15:26] okay this updated but this one is not so we need to work on that and this should disappear whenever we whenever we are actually
[15:43] seen the notifications so we just work on that on the next
