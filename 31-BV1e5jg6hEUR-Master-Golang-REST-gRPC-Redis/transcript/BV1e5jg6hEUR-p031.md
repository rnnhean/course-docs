[00:00] hello and welcome on this lecture we will start creating the notification whenever we need this for example here on user just go to we need to collapse this or we can directly move to following user all right and start have another schema here
[00:27] change this to notification schema all right and we need to change this to notifications all right and after that we have this to do here we'll just start work on that we need to remove this to do
[00:57] and then we can just start from here first by create the notification let's just say notification and this will be available include our models notification and the main user ID will be first user ID first user
[01:26] it will be a first user ID to hex target ID will be second user dot ID hex all right or after that the details can be second
[01:55] user name plus can just say here space stored following you something like that after that the user can be models user the name
[02:24] will be second user dot name and the avatar can be second user dot image URL very well finally create it at can be just time dot now assemble as that after that we can just do here
[02:53] no no no not here below this one you can say just for now underscore an error for notification schema dot insert to one pass to a d context and the notification there all after that we can just say f error
[03:22] not equal to 0 we can just return anything we can just say return c.status yeah fiber fiber fiber internal server error.jsonfiber.map
[03:52] can just come here and say message field to create notification error error not error all right we can just now hit save and I believe that we are nearly ready but we just
[04:21] start by create the other ones and test all one type just search for to do where are we comment on post yeah we are here just remove this to do let's just have a quick check here all right
[04:50] first of all we need to go back here copy this notification schema paste it here as well and it look like that we need to get the user from where we can get that user if you remember this actually use security per rod and we need
[05:20] to extract the user id and then get the user from the database for that you can just say user id equals c.locals user id on this string write after that you can just say user error goes to you can just say get
[05:50] users by id we need to create a function for that i think or we'll just copy this one and simply paste that here okay we need to create actually another one for users
[06:17] just go to the users control, just copy this one, this simple user schema, paste that here, where the user will be, here it is, we can copy all this,
[06:45] go back and now we can go down here and paste that one alright ok we need to copy this one and just paste that here
[07:13] i just remove this one and this one all right and if we go back here you'll see that we can do all this let's just do it no problem with that we need just to have this user variable
[07:42] also we can copy and paste it here all right I think that's fair enough now we can just go to the user we have only one to do where is that
[08:06] we need to search for following yeah can just grab all this and simply visit here you just
[08:34] to fix this format a little bit do we have any kind of problem here no okay now we need to work on that first the main user the main new id will be post dot creator or we can directly pass this user id anyway posts are the same target id
[09:03] will be post id x if you remember we do have this post id here all right what after that let's just change this all this second user to just user user that we extracted and change this
[09:33] to comment on comment or commented on your post or else do have here who need just to remove
[10:01] this column and we're done here all right i believe that this took a little bit too much to get the user etc but anyway i just leave it as this
[10:26] and after that we do have another one for the posts for that we can just copy nearly all this search for to do start creating notification paste that here
[10:54] right hand first of all from where we are getting this id not from this place let's just remove this one we do have already this id we need to define the user schema i just copy from here and also need to define notification
[11:23] we can copy both of them go down here and paste that here right so that we extracting getting the user okay and then we have this would be also post creator this
[11:53] should change to post id x all right the username everything is the same need to change this to like your post all right we are ready now to test just check out this all right it's ready
[12:22] I start to ready with login as ISO now we will try to following Ahmed just hit on execute see what we will have right look like at every single sign we need to refresh this hit on refresh all right to have this notification now and we have this
[12:50] user object isle 2 isle 2 started following you look this works fine we need to have another one where we try to like post check that out go on back refresh we have this one isle 2 like your posts alright we didn't have avatar because isle
[13:19] if we go back where is isle users isle doesn't have any avatar right now or mhgl is empty so it is empty fine and finally we need to test this one comment post hit on execute go back on notification i need i believe to refresh
[13:48] We have this on zero, it's also commented on your post. Very well, till now everything works fine. We can now move on to the next lecture to go start creating these two endpoints.
[14:04] you
