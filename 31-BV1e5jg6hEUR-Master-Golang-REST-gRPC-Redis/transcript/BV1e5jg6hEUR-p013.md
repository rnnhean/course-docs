[00:00] hi and welcome after we creating the sign up sign in gate user we want now to create update user endpoint for this we can just start by go ahead to the user routes and start in here and say app.patch slash user slash update
[00:26] and this will be dynamic bird so we would add a column here alright and then now we want to add our middleware for authentication and this operation will not be related only to the authentication it will be an authorization we'll see that by ourselves when we do when we create the function
[00:54] which we can name it update user write note that we didn't have this function yet we will create it in a minute now we can just go to the user controller I believe that we can just copy this then let's just
[01:21] simply duplicate it and change this to update user right now this should be convert to normal there is no error now let's just start by change this update user okay just remove this one at the summary we can just say update
[01:51] user data description update user details anything tags of the user after the tags write what else to have we need to get the ID
[02:19] all look like that everything is nearly the same but of course we need to come here and add the security i can just say add security perros
[02:48] alright and then we should come here and change this to update finally you need to change this to patch of course we can use put but I prefer to use patch anyway after we can just leave all this nearly all of this and I can just start from here
[03:18] first of all want to make kind of authorization and how we can do this, if we go back to the Oath middleware you'll see that after we extract the user ID on the token we can also extract it from the token by this way, this is exactly how we are doing here on this part of the code and we put it
[03:46] To the request to the next Handler for the request So we can get in the ID from the extracted token and compare it with ID that we get it from the path if we have Typical if we are if they are similar this is mean that We have authentication we are authorized to do this or
[04:13] to complete the update operation if not we should return error for all i just stored by say extracted uid all right i just show this to exit uid
[04:42] and we can just say this will equal to c.locals user id and we can convert this and just come here and say this is actually a string variable or after that declare and not use okay after that we can just
[05:10] stored by define variable or getting the the user ID we just came here or we can just make the compare directly we can just say if if this xeoid not equal to
[05:39] c.perms id on that case and to return the error I can just copy this one directly paste it here successful message I can just say you are not
[06:06] unauthorized to um update this row file right you can just say not bad gateway unauthorized status code which is 400 done on very well after that you can just
[06:36] get or convert this user id to primitive object id from hex so we can just say user id underscore this will goes to primitive dot object from hex and we can just say c.params
[07:04] this ID role now we want to before this actually we need to extract the body and for that we want to have another separate model if you go back here you'll see that we can come here
[07:32] and create a new interface for this I just say type we can call it update user struct what we want to be able to update the name which will be string or else the image URL
[07:59] string this can be a capital case and the image URL okay I'm finally the boil which is also a string we're all now just let's save
[08:27] go back here and let's just copy this one and directly paste it here all right but we need to change this to update and change this body to user user all right
[08:56] We are extracting the data from the request body by using C body bursar That is that sample Or else we need now we need to add the update that we want we can just say update variable will include peso.m First the name
[09:25] and just say user dot name next image URL user dot image URL bio user dot bio simple as that now we can use update on put this on result and error
[09:52] this will return, this function will return result and error, alright. After that, what we want to do, we can just say, user schema, lot, update on. Okay, and the syntax, ctx, something's not right, ctx. Next, we say peso, m.
[10:21] first we say underscore id we can pass column user id variable write or else just add a comma
[10:50] here we are passing the filter this will be our filter first we will pass the syntax we pass it then the filter finally we pass the update interface we can just say peso m and we can simply use set operator by say dollar sign set column
[11:19] and pass the update that we want now we can just come here and say fr not equal to null on that case we cannot return anything just copy this one
[11:48] here and just say internal server error cannot of the user data and just say data or this one or let us leave it
[12:16] details all right after all we will actually need on our application to have the updated user posts all the posts that or no we didn't need that but we can just
[12:45] now get the updated user after we've done this operation so we can just say var updated user models sorry instead of create user just user user model yep
[13:12] you can just say f result dot match count equal equal on one dot case and just say error goes to user schema dot fine one pass this the context person dot m underscore id
[13:42] sorry sorry sorry user ID all right after all we can decode the result with this user update see our updated user variable code and we can just copy this one
[14:11] just paste it here and just remove this error but this can be not found and I don't know yet not found status not found there all I believe we are cool finally we can came here and say sorry sorry sorry return c.status
[14:39] fiber.oc status.oc ninjson fiber map data and we can just pass this updated user and voila we're here now just test our endpoint if we are not running the app
[15:08] i just say air hit enter open the browser all right we have this user get host call um that's actually happening because we didn't say so again if you go here we are saying
[15:35] Let's make swag in it. Let me just copy it. All right, stop our app. Same make as this. Swag in it. This will generate the new documentation. Just run our app one more time. Go back, refresh. Voila.
[16:04] this is all i have updated user an id all right first follow need to login just i'll just stop the video until i log in and go back to you all right i log in as ahmad user note that this is the user result now i will copy the token
[16:31] just came here on authorization, paste that here, hit authorize, close and we can just close this one or just open it and copy this id, now just copy this id
[17:00] and go to our endpoint for update pass this ID all right look like something is not correct yep definitely something is not correct it is actually with our documentation if we come here you'll see that we are we should pass this ones here
[17:27] exactly like we did here I just copy this one and go back to our user controller paste that on here and instead of this one I just change this and just say needy details
[17:51] okay and change user body models instead of this one we need to have models update user okay cool now let's just go back we need to copy this token otherwise we will be forced to
[18:17] sign in again okay just save it somewhere and just paste it here alright now we need to re-operate from the beginning hit mix or gun it
[18:45] alright also we need to get this ID just save it here and now we need to run our app one more time wait until this running finally refresh this as you can see now we have this body just now try it again first copy the token
[19:15] paste it here at authorize close then get the id go back here paste that id bio can just call it update bio mgoral can just say page 64 any data here okay name let's just call it Ahmed Khalaf
[19:44] all right finally we can just hit on execute wait until we got the result look like that we have 200 response wait to make sure that everything is okay note that this is the data that we have what if we now hit on refresh as you can see Dubai has been updated image URL has been updated also the name has been updated okay call what we are now trying
[20:13] to update the other user which is ISO with the initial token this should not allow us to update it instead we are not what I want to say here is as we all know we have different levels of security
[20:40] and here we have only two level first one for the only authenticated users and the second one for the authorization which is the top layer it is not enough to have correct and non-expire token to be able to update user data it should be token related to or owned by this user very well let's just now
[21:10] change the id ok it look like that i didn't copy it correctly copy this ones here paste it here and try to update this head on execute alright as you can see here is the error message that we passed you are not authorized to update this profile very well if you go back you'll see nothing
[21:38] as it happened all right i believe that's very good we're cool here and that's all for this endpoint on this lecture we can complete our mission on the next lecture
[21:55] you
