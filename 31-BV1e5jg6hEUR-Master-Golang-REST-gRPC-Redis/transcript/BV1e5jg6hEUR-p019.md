[00:00] welcome back my dearest friend on this lecture we will start create update post end point we are using patch as always of course you can use put but i prefer to use patch anyway i just start by creating or calling the routes here i believe that we didn't need this port now so we can just we can just
[00:28] deleted and i believe that we forget to have update here i just put it below the above the comment we can just say update yep all right now we can just create it we can just say app.patch slash posts
[00:57] slash we can just pass ID as a theorem of course we need to have middleware uh middleware controllers yeah uh yeah controllers we'll just change this to update post
[01:22] and since that we will use this nearly the same input which is if you remember create or delete post this is mean that we can use same validation so I just came here and say validation validator post sorry validate post yep
[01:51] and that's pretty it now we need just to come here inside post controller we didn't need to have this one open you can just copy this one for create go below this one and paste that here change this to update hit save now the error here should disappear yep
[02:21] all right then we can just start from here change this create with instead of 5 create we can just say update update boost update boost yep
[02:46] what else do we have? the tags is the same produce json we need to have param as well here just compare and say add param id pass string sorry string yep true post id
[03:15] all right we can just change this to update update post details all right and we can just come here now and say this to 100 we need to of course pair source
[03:42] and we have a dynamic port here which will be the id and here we can just game and say patch alright then now we didn't need to have this user just remove it okay we need also to remove this port or else we need to do
[04:11] yep we can just click here we need to have kind of authorization we need to make sure that the create a post is the first one we need actually to get the post so just
[04:40] got this here put it here all right after that we need to came here and say we can just post yep we can change this to post and then copy this put that down here and this we can call it post
[05:08] remove this tree or take them out okay and here we can just find one make the code yeah this will not be correct you can just directly copy this one change this
[05:38] and we want to decode this post we can now remove this one and we can copy this one now we can just say primitive
[06:04] or just get it on a separate level post id sorry post id up equal to c.params id we can just come here and say
[06:32] primitive or prem id and we can just come inside here and say you need to define the error short we can just leave it as it is or let's just define it and then we can just come here and say primitive object from hex
[06:59] and pass this thing here and finally we can pass this primitive id all right if we do have an error i just go here and get post by id yep we can just copy this one go down down down down and just put that here since that we got an error
[07:29] right here the authorization we want to say if this AuthPost.creator is not equal for this C.locals
[07:58] user id is exactly the same name that we extracted here if you remember I just came down here and say dot string if that decays what we want to do we can just copy this one
[08:24] have this error change this to you are not authorized to update this post simple as that what next
[08:52] we can just come here this is the body we just change it to new data change this to new data can come down here
[09:15] and say that the post title will equal any state of this. We just change it with new data. Alright, we can now remove all this.
[09:41] to have this comment here call what after that we can just came here and say result an error post this schema this should be update one
[10:08] Contacts, and this shouldn't be like that. I can just say, pencil, M, dollar sign, set, post.
[10:33] Right, looks like something is not right. Yeah, we couldn't have it by this way. Alright, we just remove all this and came here and say update it. So, update. So, equal pysl.m. The...
[11:02] title post dot or updated or new data not title message will be this new data dot message
[11:30] selected file will be post.selected file sorry this is not post this is new data as well just copy this paste it here to make sure that we have same spelling change this S to small case
[11:59] right now we can just say pessim.m here we can pass oops I'm sorry the idea here that we didn't pass a filter this is the filter that we should have we can just came here and say pessim.m
[12:27] underscore id post id but where all this should come from we call it auspost let's just come here say auspost.id is this a primitive object id we need to make sure that this primitive object id
[12:57] so for that we can just came here and say post id didn't need to check for error because this returned to us from the database so we can just directly say primitive dot object id from x and pass this all right we can now copy this one and paste it here
[13:24] now we can came here after the amp we didn't need to do all this we can just came here and say update all right I'm sure why is that cannot use or whatever look so we can just has it like this so we just cut this
[13:51] directly past it here and I'm not sure about this can we just say auth post yeah it is working so we can just remove this or take this out come here say auth post or title or the equal new data
[14:21] title, we just duplicate this right after the title the message or after the message the selected file all right look like until now everything look fine if this not equal null we can just appear and say internal server error
[14:51] and we can just look in here on JSON say object of fiber map sorry pointer of fiber map data
[15:17] Error.error Yeah, exactly like that. Alright, otherwise while we have getPauseDetails, otherwise we can directly... We didn't need to do anything, we can just...
[15:47] came down here and remove all this we didn't need to have it and so we need to remove that column we can just say fiber dot map data this source post
[16:16] similar as that now just hit save and now we need to run our helper make swag init initializing saga documentation all right we don't have application refreshing just go to this file in okay
[16:44] i'll just stop the video or i'll just stop by say refresh cool we have this patch it's a required id and the rest okay if we we need to refresh this we have to yep just copy that one paste that here and directly hit on execute this will
[17:13] I'll just stop the video, go and create a post with the other user to be able to test it. Also login with Dahmad, so I'll go back after on doing this. Alright, I'm now creating a post like for Isle. Alright, this is the post ID. This is the creator ID.
[17:40] now i'm going back here and i'm trying to assign in azahmed all right now i'm gonna copy this off paste it here head to sunrise head close and here on patch yep we do have this one so this is mine actually
[18:06] it's my post if we go back here refresh you'll see we got my first post Ahmed we got my second post as as well we got my second post as Ahmed alright here we have my first post okay now let's just say updated post updated
[18:34] updated all right now if we hit on execute as you can see it look like that this has been updated successfully we need to make sure this has been updated we just hit on refresh yep we have title updated message updated
[18:59] selected file updated and this is only things that we should allow our user to update all right what if we now try to update the ISO post this one's here the last one just refresh the ISO post ISO for response we want to update it as Ahmed just pass the
[19:24] ID to hit on execute As you can see this will give us you are not authorized to update this post Of course if we missed any of these fields Just remove these two fields for example and hit execute As you can see you got message and record with 400 error by request Very well
[19:54] I think that's all what we want to do in this lecture. We can now move on to the next lecture.
[19:59] Thank you.
