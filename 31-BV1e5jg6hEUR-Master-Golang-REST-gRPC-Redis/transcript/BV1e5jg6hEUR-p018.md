[00:00] hi and welcome on this lecture we will work it on getpost endpoint and we need to have of course the id of the post to we can say getpost by the endpoint we're all starting as normal we didn't need to have this anymore we just remove all or close the steps go to the post route get on
[00:27] and you can just store by coming here and say app.get demessotype is get the pass posts slash ID and just now came and say controllers instead of create a post and just say get post
[00:55] all right let's save going back and let's just copy all this go down this, paste it here and let's just start working on it on by on first of all we didn't need to have a security this will be in get just change this to get we didn't need to have this one of course
[01:24] we can replace it despair with id path string through can just say post id all right this will return not hundred none just 200 slash
[01:48] id which is dynamic part so we put it between color presses and the main subtypes get here we need to change this career to get post the error should disappear now yep alright after that we can just start boy I was thinking about
[02:17] to change the name of this post but we just leave it as this anyway we didn't need to have the user so we just remove it we didn't need to have this body but we need to make sure that we have this param so we can just say
[02:45] id error c.params id it is a return just on yep okay this should be string now
[03:09] we can just came here and saying FID FID equal equal just an empty string in that case we can just came here and say ID is required
[03:37] Or I can name it both tidy. Alright, what next? Exactly like what we have here. Can have something similar. Just copy this.
[04:04] who can remove all this? paste that here first we need to say object ID underscore or who need to define that error say primitive object ID from hex pass to it this ID
[04:32] and we can just copy this one paste it here and then what we need to change this with the error not equal to 0 on that case we want to have error not error yep
[04:58] we need to fix this OBGID alright that's cool now we can just copy this one and paste it here also we can just add some errors here on this part we can just say final result
[05:27] This one goes too. This one is error, yep. So I can just copy this one. I just came here, paste it here. I just now came down here and say success.
[05:56] just false message can just say post not found I can change this to not found status not found alright what after all we can just came here say status
[06:26] created this should be an ok status ok and here on JSON let's not create post let's just change this to just post and here we just take this out and say foible map post post
[06:55] We do have an error, I'm not sure why. Yeah, we need to take this out. Now just hit save, we need to test this. Alright, you lost post ID, this one.
[07:24] just create another one first we can just say second okay second okay and then just hit on execute and just create to us the second post but before we test that we need to come here hit make so again it run on a boomer time
[07:52] all right we can now refresh we do have post and get my id paste the id now this should return to us id1 the post on or first post yep it returned to us the first post all right
[08:20] Look like that our endpoint worked perfectly. We can now move on to the next lecture.
[08:26] Thank you.
