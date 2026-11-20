[00:00] hi and welcome on this lecture we will start building command post endpoint but all we just start by going to the VS code stored here on post and we can go come here and below this one stored say app. this is actually you would be post slash post post slash
[00:29] Actually we need to add a dynamic port here. I'm going to say the score ID. Comment. Post. We need to add the middle version to the kitchen. Controller. Comment. Post. Alright.
[00:57] now just go back here we can grab the last one or i believe that it is better to copy of the post because they are nearly similar copy paste that here all right and now we need to copy the handler method function name
[01:26] paste that here now the error will disappear from here now we need to go to body models and change this to comment I believe that we already have it let's just check that out okay we have create let's just simply
[01:48] copy this one and we need to remove the first and second this one will be value all right this may just go right there comment post now we need to go back here
[02:13] change this to give it the same name comment post right this one as well okay look like that we got an error yep anyway no problem we need to start from here this one not update
[02:39] it is command just change this command to be command all right uh on perm id pass string true this one people study this is nearly the same after that
[03:06] we can just call this command value all right we will have a stopping button we need to change this router pass this actually will be post also we need to after that have comment comment sorry come
[03:35] post exactly like we have here I just copy it to make sure that we have exact same name all right all right after that we need to call this something like B I just have it be all right we extracting that
[04:02] and we just remove the rest and we need to extract the post id we can just come here and save our post models post model and then save post id on recall underscore
[04:31] equal to primitive object id from hex yeah c.params.id not . inside of it we will pass the id after that we can just say post schema . okay we can just put it on error post
[05:01] schema find on cdxpeso.m underscore id conom post id
[05:28] right after all we can just say decode this post you should return an error here so if we got an error just copy this paste here also we can have an error here as well just paste that here
[05:53] all right i need to do what something is not right declared and not used yeah that's because we do need to remove this one just remove it from here and here also i need to remove this column all right
[06:22] just remove this and remove this change this to something like internal server error something like that yeah all right after we did hold this we can just stop by say new comment
[06:50] which are equal to peso dot I need to say m yep the name of this field is comments okay
[07:18] now what we want to do is we want to append this post dot comments with this b dot value symbol as dot after dot we can just say post schema uh sorry post schema yep dot update one nope nope nope nope up the tone
[07:44] and we can use set operator and pass here the new comment all right to our call after that we can just
[08:13] turn came down here and say post schema find on buzz decontext ctx paste on dot m underscore id actually we can do m do this port let me just copy this
[08:42] remove this paste that again and we need to have that kind of error here so we can just skip here and say error only call came here paste that here yes yeah this is returned to
[09:08] x what this x represent okay adjust the column now what this x represent this represent a var of error this also var of error so just leave it as it is
[09:35] now what is that okay you can just come here say this will be the error go back here say underscore this will work alright here we need to have kind of to do
[10:05] create notification stored and all right after all we can just say return c.status.oc a fiber.oc status.oc json
[10:34] Fiverr.map Just say data will be disposed add comma save only to save all I Have something here is my right to comment post Why is that undefined comment post why? It's Eve
[11:03] If we hit click, it goes to it, it is defined actually, yep. Now we can take our app out, run this work, initialize, run our app one more time. We need now to go back. Okay, I think we need to just start by refresh.
[11:27] not that this actually use a pair also we need to login as one of our users just came here say A at A we're gonna use this we want we are actually use this authentication because we want to extract the commenter ID because we will use a notification later we will use it while we are
[11:55] adding this notification board later anyway I just now go back say pass the ID sorry pass the password hit execute call we need now to grab this token say copy pass the token here head authorized close all right
[12:23] now we have this comment on post hit on tryout all right let me just say Ahmad first comment and now we need to go back to the this one no we need to go here on posts yep we want to get the latest ISO posts let's just copy the ID
[12:51] note that we didn't have any commands here it is an empty array all right pass the ID now I just execute where is the response yep we have the response the updated comment and the updated post after we add the comment if we go back to the browser refresh this one as you can see now we have a new
[13:18] I hit him to our comments. Ahmed first comment. What will he start to add another one? Just say second. Now I hit on execute. We have this one. I want to make sure that this doesn't remove the old comments. So just refresh. As you can see we have the second one. Ahmed second comment.
[13:46] It looks like that everything works fine, our endpoint worked perfectly, so we can now move on to the next lecture.
[13:53] Thank you.
