import os
from PIL import Image

def generate_all():
    base_dir = r"d:\Preet\Others\Projects\desktop-cat"
    sprites_dir = os.path.join(base_dir, "public", "sprites")
    cat_path = os.path.join(sprites_dir, "cat.png")
    
    cat = Image.open(cat_path)

    # 1. Palettes
    OUTLINE = (18, 14, 20, 255)
    FUR_WHITE = (225, 222, 231, 255)
    FUR_SHADOW = (189, 181, 200, 255)
    EAR_SHADOW = (154, 135, 126, 255)
    PINK = (202, 113, 159, 255)
    PINK_LIGHT = (225, 151, 198, 255)

    # Food bowl (matching user's uploaded food bowl image)
    BOWL_RIM_LIGHT = (166, 185, 170, 255)
    BOWL_RIM_MID = (120, 141, 130, 255)
    BOWL_RIM_DARK = (87, 104, 99, 255)
    BOWL_BASE_SHADOW = (57, 53, 58, 255)

    FOOD_LIGHT = (160, 128, 98, 255)
    FOOD_MID = (135, 97, 65, 255)
    FOOD_DARK = (100, 66, 47, 255)

    WATER_LIGHT = (160, 205, 245, 255)
    WATER_MID = (95, 145, 220, 255)
    WATER_DARK = (55, 90, 170, 255)

    HAND_LIGHT = (255, 225, 205, 255)
    HAND_SHADOW = (225, 180, 155, 255)

    HEART_RED = (235, 65, 100, 255)
    HEART_LIGHT = (255, 150, 175, 255)
    GOLD_SPARKLE = (255, 215, 0, 255)

    # Bowl patterns
    bowl_heaping = [
        '    #fffff#    ',
        '  ##fFffFff##  ',
        ' #fFfffFffFf# ',
        '#LLMMMMMMMDDD#',
        '#LLMMMMMMMDDD#',
        ' #MMMMMMMDDD# ',
        '  #########   ',
    ]
    bowl_full = [
        '               ',
        '   #########   ',
        ' ##fFffFffFf## ',
        '#LLMMMMMMMDDD#',
        '#LLMMMMMMMDDD#',
        ' #MMMMMMMDDD# ',
        '  #########   ',
    ]
    bowl_low = [
        '               ',
        '   #########   ',
        ' ##SSSSSSSSS## ',
        '#LLddfFdFfdDDD#',
        '#LLMMMMMMMDDD#',
        ' #MMMMMMMDDD# ',
        '  #########   ',
    ]
    bowl_empty = [
        '               ',
        '   #########   ',
        ' ##SSSSSSSSS## ',
        '#LLSSfSSfSSDDD#',
        '#LLMMMMMMMDDD#',
        ' #MMMMMMMDDD# ',
        '  #########   ',
    ]
    bowl_water = [
        '               ',
        '   #########   ',
        ' ##wwWWwwWWw## ',
        '#LLMMMMMMMDDD#',
        '#LLMMMMMMMDDD#',
        ' #MMMMMMMDDD# ',
        '  #########   ',
    ]
    bowl_water_ripple = [
        '               ',
        '   #########   ',
        ' ##WWwwWWwwW## ',
        '#LLMMMMMMMDDD#',
        '#LLMMMMMMMDDD#',
        ' #MMMMMMMDDD# ',
        '  #########   ',
    ]

    def render_bowl(pattern, offset_x=9, offset_y=19):
        im = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
        cmap = {
            '#': OUTLINE, 'L': BOWL_RIM_LIGHT, 'M': BOWL_RIM_MID, 'D': BOWL_RIM_DARK,
            'S': BOWL_BASE_SHADOW, 'F': FOOD_LIGHT, 'f': FOOD_MID, 'd': FOOD_DARK,
            'W': WATER_LIGHT, 'w': WATER_MID, ' ': (0,0,0,0)
        }
        for r_idx, row in enumerate(pattern):
            y = offset_y + r_idx
            for c_idx, ch in enumerate(row):
                x = offset_x + c_idx
                if ch in cmap and cmap[ch][3] > 0 and 0 <= x < 32 and 0 <= y < 32:
                    im.putpixel((x, y), cmap[ch])
        return im

    # Bowls
    b_heap = render_bowl(bowl_heaping)
    b_full = render_bowl(bowl_full)
    b_low = render_bowl(bowl_low)
    b_empty = render_bowl(bowl_empty)
    b_water = render_bowl(bowl_water)
    b_water_rip = render_bowl(bowl_water_ripple)

    # Base poses from cat.png
    idle = cat.crop((0, 0, 32, 32))
    happy = cat.crop((0, 32 * 32, 32, 33 * 32))
    groom2 = cat.crop((2 * 32, 36 * 32, 3 * 32, 37 * 32))
    groom3 = cat.crop((3 * 32, 36 * 32, 4 * 32, 37 * 32))
    side_left = cat.crop((2 * 32, 1 * 32, 3 * 32, 2 * 32))
    side_right = cat.crop((3 * 32, 1 * 32, 4 * 32, 2 * 32))

    # ==========================================
    # 1. FRONT EATING ANIMATION (8 frames)
    # ==========================================
    eat_front_frames = []

    # Frame 0: Eager sitting cat looking down at heaping bowl
    f0 = idle.copy()
    f0.putpixel((12, 12), FUR_WHITE)
    f0.putpixel((12, 13), OUTLINE)
    f0.putpixel((12, 14), OUTLINE)
    f0.putpixel((18, 12), FUR_WHITE)
    f0.putpixel((18, 13), OUTLINE)
    f0.putpixel((18, 14), OUTLINE)
    f0 = Image.alpha_composite(f0, b_heap)
    eat_front_frames.append(f0)

    # Frame 1: Head lowering down towards bowl
    f1 = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    for y in range(16, 26):
        for x in range(32):
            f1.putpixel((x, y), idle.getpixel((x, y)))
    for y in range(7, 16):
        for x in range(32):
            p = idle.getpixel((x, y))
            if p[3] > 0:
                f1.putpixel((x, y + 1), p)
    f1.putpixel((10, 16), OUTLINE)
    f1.putpixel((21, 16), OUTLINE)
    f1.putpixel((12, 13), FUR_WHITE)
    f1.putpixel((12, 14), OUTLINE)
    f1.putpixel((12, 15), OUTLINE)
    f1.putpixel((18, 13), FUR_WHITE)
    f1.putpixel((18, 14), OUTLINE)
    f1.putpixel((18, 15), OUTLINE)
    f1 = Image.alpha_composite(f1, b_heap)
    eat_front_frames.append(f1)

    # Frame 2: Munching in bowl (head dipped, snout touches food)
    f2 = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    for y in range(16, 26):
        for x in range(32):
            f2.putpixel((x, y), idle.getpixel((x, y)))
    for y in range(8, 17):
        for x in range(32):
            p = groom2.getpixel((x, y))
            if p[3] > 0:
                f2.putpixel((x, y), p)
    f2.putpixel((10, 16), OUTLINE)
    f2.putpixel((21, 16), OUTLINE)
    f2.putpixel((10, 18), FOOD_LIGHT) # crumb
    f2.putpixel((22, 18), FOOD_MID)
    f2 = Image.alpha_composite(f2, b_full)
    eat_front_frames.append(f2)

    # Frame 3: Head lifts slightly, chewing contentedly (^ ^)
    f3 = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    for y in range(16, 26):
        for x in range(32):
            f3.putpixel((x, y), happy.getpixel((x, y)))
    for y in range(7, 16):
        for x in range(32):
            p = happy.getpixel((x, y))
            if p[3] > 0:
                f3.putpixel((x, y + 1), p)
    f3.putpixel((10, 16), OUTLINE)
    f3.putpixel((21, 16), OUTLINE)
    f3.putpixel((15, 17), FOOD_LIGHT)
    f3 = Image.alpha_composite(f3, b_full)
    eat_front_frames.append(f3)

    # Frame 4: Second deep bite into bowl! (Kibbles down to low)
    f4 = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    for y in range(16, 26):
        for x in range(32):
            f4.putpixel((x, y), idle.getpixel((x, y)))
    for y in range(8, 17):
        for x in range(32):
            p = groom2.getpixel((x, y))
            if p[3] > 0:
                f4.putpixel((x, y), p)
    f4.putpixel((10, 16), OUTLINE)
    f4.putpixel((21, 16), OUTLINE)
    f4.putpixel((11, 19), FOOD_LIGHT)
    f4 = Image.alpha_composite(f4, b_low)
    eat_front_frames.append(f4)

    # Frame 5: Chewing happily, bowl empty
    f5 = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    for y in range(16, 26):
        for x in range(32):
            f5.putpixel((x, y), happy.getpixel((x, y)))
    for y in range(7, 16):
        for x in range(32):
            p = happy.getpixel((x, y))
            if p[3] > 0:
                f5.putpixel((x, y + 1), p)
    f5.putpixel((10, 16), OUTLINE)
    f5.putpixel((21, 16), OUTLINE)
    f5.putpixel((16, 16), PINK)
    f5 = Image.alpha_composite(f5, b_empty)
    eat_front_frames.append(f5)

    # Frame 6: Licking inside the empty bowl clean!
    f6 = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    for y in range(16, 26):
        for x in range(32):
            f6.putpixel((x, y), idle.getpixel((x, y)))
    for y in range(8, 17):
        for x in range(32):
            p = groom2.getpixel((x, y))
            if p[3] > 0:
                f6.putpixel((x, y), p)
    f6.putpixel((10, 16), OUTLINE)
    f6.putpixel((21, 16), OUTLINE)
    # Tongue licking bottom of bowl
    f6.putpixel((15, 19), PINK)
    f6.putpixel((16, 19), PINK_LIGHT)
    f6.putpixel((17, 19), PINK)
    f6.putpixel((16, 20), PINK)
    f6 = Image.alpha_composite(f6, b_empty)
    eat_front_frames.append(f6)

    # Frame 7: Satisfied bliss! Smiling, blushing, licking lips
    f7 = happy.copy()
    f7.putpixel((10, 14), PINK_LIGHT)
    f7.putpixel((21, 14), PINK_LIGHT)
    f7.putpixel((15, 13), PINK)
    f7.putpixel((16, 13), PINK_LIGHT)
    f7 = Image.alpha_composite(f7, b_empty)
    eat_front_frames.append(f7)

    # ==========================================
    # 2. SIDE EATING ANIMATION (facing left, 8 frames)
    # ==========================================
    b_side_heap = render_bowl(bowl_heaping, offset_x=2, offset_y=19)
    b_side_full = render_bowl(bowl_full, offset_x=2, offset_y=19)
    b_side_low = render_bowl(bowl_low, offset_x=2, offset_y=19)
    b_side_empty = render_bowl(bowl_empty, offset_x=2, offset_y=19)

    eat_side_left_frames = []
    # Frame 0: Looking at bowl
    sf0 = Image.alpha_composite(side_left, b_side_heap)
    eat_side_left_frames.append(sf0)

    # Frame 1: Leaning down
    sf1 = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    for y in range(32):
        for x in range(32):
            p = side_left.getpixel((x, y))
            if p[3] > 0:
                # shift head (x < 15) down 1px
                if x < 15 and 7 <= y < 16:
                    sf1.putpixel((x, y + 1), p)
                else:
                    sf1.putpixel((x, y), p)
    sf1 = Image.alpha_composite(sf1, b_side_heap)
    eat_side_left_frames.append(sf1)

    # Frame 2: Dipping snout into kibble
    sf2 = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    for y in range(32):
        for x in range(32):
            p = side_left.getpixel((x, y))
            if p[3] > 0:
                if x < 15 and 7 <= y < 16:
                    sf2.putpixel((x, min(31, y + 2)), p)
                else:
                    sf2.putpixel((x, y), p)
    # crumb
    sf2.putpixel((4, 18), FOOD_LIGHT)
    sf2 = Image.alpha_composite(sf2, b_side_full)
    eat_side_left_frames.append(sf2)

    # Frame 3: Head lifts, chewing happily
    sf3 = side_left.copy()
    # close eye to happy slit
    sf3.putpixel((7, 12), OUTLINE)
    sf3.putpixel((8, 12), OUTLINE)
    sf3 = Image.alpha_composite(sf3, b_side_full)
    eat_side_left_frames.append(sf3)

    # Frame 4: Second bite down
    sf4 = sf2.copy()
    sf4.putpixel((3, 19), FOOD_LIGHT)
    sf4 = Image.alpha_composite(sf4, b_side_low)
    eat_side_left_frames.append(sf4)

    # Frame 5: Chewing, bowl empty
    sf5 = sf3.copy()
    sf5 = Image.alpha_composite(sf5, b_side_empty)
    eat_side_left_frames.append(sf5)

    # Frame 6: Licking bowl
    sf6 = sf2.copy()
    sf6.putpixel((5, 20), PINK)
    sf6.putpixel((6, 20), PINK_LIGHT)
    sf6 = Image.alpha_composite(sf6, b_side_empty)
    eat_side_left_frames.append(sf6)

    # Frame 7: Satisfied smile & lick
    sf7 = side_left.copy()
    sf7.putpixel((7, 12), OUTLINE)
    sf7.putpixel((8, 12), OUTLINE)
    sf7.putpixel((5, 13), PINK) # tongue licking lip
    sf7 = Image.alpha_composite(sf7, b_side_empty)
    eat_side_left_frames.append(sf7)

    # ==========================================
    # 3. SIDE EATING ANIMATION (facing right, 8 frames)
    # ==========================================
    # Horizontally flip side_left frames
    eat_side_right_frames = [f.transpose(Image.FLIP_LEFT_RIGHT) for f in eat_side_left_frames]

    # ==========================================
    # 4. DRINKING WATER/MILK ANIMATION (8 frames)
    # ==========================================
    drink_frames = []
    for i, (cat_base_frame, bowl_var) in enumerate([
        (f0, b_water),
        (f1, b_water),
        (f2, b_water_rip),
        (f3, b_water),
        (f4, b_water_rip),
        (f5, b_water),
        (f6, b_water_rip),
        (f7, b_water),
    ]):
        # Composite cat with water bowl instead of food bowl
        cat_no_bowl = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
        # Take cat pixels from eat_front_frames
        src_f = eat_front_frames[i]
        for y in range(32):
            for x in range(32):
                p = src_f.getpixel((x, y))
                # don't copy food colors
                if p not in [FOOD_LIGHT, FOOD_MID, FOOD_DARK, BOWL_RIM_LIGHT, BOWL_RIM_MID, BOWL_RIM_DARK, BOWL_BASE_SHADOW]:
                    cat_no_bowl.putpixel((x, y), p)
                else:
                    # check if it's the cat body behind
                    idle_p = idle.getpixel((x, y))
                    if idle_p[3] > 0 and idle_p not in [OUTLINE, FUR_SHADOW]:
                        cat_no_bowl.putpixel((x, y), idle_p)
        dr = Image.alpha_composite(cat_no_bowl, bowl_var)
        drink_frames.append(dr)

    # ==========================================
    # 5. PETTING ANIMATION (8 frames)
    # ==========================================
    def draw_heart(im, ox, oy):
        grid = [' # # ', '#R#R#', '#RRR#', ' #R# ', '  #  ']
        for r, row in enumerate(grid):
            for c, ch in enumerate(row):
                x, y = ox + c, oy + r
                if 0 <= x < 32 and 0 <= y < 32:
                    if ch == '#': im.putpixel((x, y), OUTLINE)
                    elif ch == 'R': im.putpixel((x, y), HEART_RED)

    def draw_small_heart(im, ox, oy):
        grid = ['# #', '#R#', ' # ']
        for r, row in enumerate(grid):
            for c, ch in enumerate(row):
                x, y = ox + c, oy + r
                if 0 <= x < 32 and 0 <= y < 32:
                    if ch == '#': im.putpixel((x, y), OUTLINE)
                    elif ch == 'R': im.putpixel((x, y), HEART_RED)

    def draw_sparkle(im, ox, oy):
        im.putpixel((ox+1, oy), GOLD_SPARKLE)
        im.putpixel((ox, oy+1), GOLD_SPARKLE)
        im.putpixel((ox+1, oy+1), (255, 255, 255, 255))
        im.putpixel((ox+2, oy+1), GOLD_SPARKLE)
        im.putpixel((ox+1, oy+2), GOLD_SPARKLE)

    def draw_hand(im, ox, oy, pose=1):
        if pose == 1: # High hand entering
            grid = [
                '    #### ',
                '  ##LLLL#',
                ' #LLLLLM#',
                '#LLLLLM# ',
                '#LLLLM#  ',
                ' ###M#   '
            ]
        elif pose == 2: # Resting/petting head
            grid = [
                '     ###  ',
                '   ##LLL##',
                ' ##LLLLLL#',
                '#LLLLLLLM#',
                ' #LLLLLM# ',
                '  #####   '
            ]
        elif pose == 3: # Stroking down
            grid = [
                '    ####  ',
                '  ##LLLL# ',
                ' #LLLLLM# ',
                '#LLLLLLM# ',
                ' #LLLLM#  ',
                '  ####    '
            ]
        for r, row in enumerate(grid):
            for c, ch in enumerate(row):
                x, y = ox + c, oy + r
                if 0 <= x < 32 and 0 <= y < 32:
                    if ch == '#': im.putpixel((x, y), OUTLINE)
                    elif ch == 'L': im.putpixel((x, y), HAND_LIGHT)
                    elif ch == 'M': im.putpixel((x, y), HAND_SHADOW)

    pet_frames = []

    # Frame 0: Cat looks up, hand appears
    pf0 = idle.copy()
    pf0.putpixel((12, 13), FUR_WHITE)
    pf0.putpixel((12, 11), OUTLINE)
    pf0.putpixel((18, 13), FUR_WHITE)
    pf0.putpixel((18, 11), OUTLINE)
    draw_hand(pf0, 16, 2, pose=1)
    pet_frames.append(pf0)

    # Frame 1: Hand lands on head between ears
    pf1 = idle.copy()
    pf1.putpixel((12, 12), OUTLINE)
    pf1.putpixel((18, 12), OUTLINE)
    draw_hand(pf1, 12, 4, pose=2)
    pet_frames.append(pf1)

    # Frame 2: Hand pets down, cat squishes into touch
    pf2 = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    for y in range(16, 26):
        for x in range(32):
            pf2.putpixel((x, y), happy.getpixel((x, y)))
    for y in range(7, 16):
        for x in range(32):
            p = happy.getpixel((x, y))
            if p[3] > 0:
                pf2.putpixel((x, y + 1), p)
    pf2.putpixel((10, 16), OUTLINE)
    pf2.putpixel((21, 16), OUTLINE)
    draw_hand(pf2, 11, 5, pose=3)
    pet_frames.append(pf2)

    # Frame 3: Cat in pure bliss! Cheeks blush, eyes ^ ^, heart floats
    pf3 = happy.copy()
    pf3.putpixel((10, 14), PINK_LIGHT)
    pf3.putpixel((21, 14), PINK_LIGHT)
    draw_hand(pf3, 9, 6, pose=3)
    draw_heart(pf3, 3, 3)
    pet_frames.append(pf3)

    # Frame 4: Second stroke, purring sparkles
    pf4 = happy.copy()
    pf4.putpixel((10, 14), PINK_LIGHT)
    pf4.putpixel((21, 14), PINK_LIGHT)
    draw_hand(pf4, 13, 3, pose=2)
    draw_sparkle(pf4, 4, 4)
    draw_small_heart(pf4, 25, 4)
    pet_frames.append(pf4)

    # Frame 5: Cat purring bliss, head tilted into touch
    pf5 = happy.copy()
    pf5.putpixel((10, 14), PINK_LIGHT)
    pf5.putpixel((21, 14), PINK_LIGHT)
    draw_hand(pf5, 11, 4, pose=3)
    draw_heart(pf5, 23, 2)
    draw_sparkle(pf5, 3, 5)
    pet_frames.append(pf5)

    # Frame 6: Hand gently lifting away, cat smiling contentedly
    pf6 = happy.copy()
    pf6.putpixel((10, 14), PINK_LIGHT)
    pf6.putpixel((21, 14), PINK_LIGHT)
    draw_hand(pf6, 17, 1, pose=1)
    draw_small_heart(pf6, 5, 2)
    pet_frames.append(pf6)

    # Frame 7: Delighted cat, tail high, happy face with blushing cheeks
    pf7 = happy.copy()
    pf7.putpixel((10, 14), PINK)
    pf7.putpixel((21, 14), PINK)
    draw_sparkle(pf7, 24, 7)
    draw_sparkle(pf7, 6, 8)
    pet_frames.append(pf7)

    # ==========================================
    # SAVE STANDALONE SPRITE SHEETS & GIFS
    # ==========================================
    # 1. cat_eating.png (4 rows: front, side left, side right, water)
    cat_eating_sheet = Image.new('RGBA', (32 * 8, 32 * 4), (0, 0, 0, 0))
    for i in range(8):
        cat_eating_sheet.paste(eat_front_frames[i], (i * 32, 0))
        cat_eating_sheet.paste(eat_side_left_frames[i], (i * 32, 32))
        cat_eating_sheet.paste(eat_side_right_frames[i], (i * 32, 64))
        cat_eating_sheet.paste(drink_frames[i], (i * 32, 96))
    cat_eating_path = os.path.join(sprites_dir, "cat_eating.png")
    cat_eating_sheet.save(cat_eating_path)
    print("Saved:", cat_eating_path)

    # 2. cat_petted.png (1 row of 8 frames)
    cat_petted_sheet = Image.new('RGBA', (32 * 8, 32), (0, 0, 0, 0))
    for i in range(8):
        cat_petted_sheet.paste(pet_frames[i], (i * 32, 0))
    cat_petted_path = os.path.join(sprites_dir, "cat_petted.png")
    cat_petted_sheet.save(cat_petted_path)
    print("Saved:", cat_petted_path)

    # 3. cat_eat_and_pet.png (Combined sprite sheet for easy viewing)
    combined_sheet = Image.new('RGBA', (32 * 8, 32 * 5), (0, 0, 0, 0))
    for i in range(8):
        combined_sheet.paste(eat_front_frames[i], (i * 32, 0))
        combined_sheet.paste(eat_side_left_frames[i], (i * 32, 32))
        combined_sheet.paste(eat_side_right_frames[i], (i * 32, 64))
        combined_sheet.paste(drink_frames[i], (i * 32, 96))
        combined_sheet.paste(pet_frames[i], (i * 32, 128))
    combined_path = os.path.join(sprites_dir, "cat_eat_and_pet.png")
    combined_sheet.save(combined_path)
    print("Saved:", combined_path)

    # 4. Animated GIF previews (scaled 6x with NEAREST)
    def save_gif(frames_list, filename, durations):
        scaled = [f.resize((32 * 6, 32 * 6), Image.Resampling.NEAREST) for f in frames_list]
        out_path = os.path.join(sprites_dir, filename)
        scaled[0].save(
            out_path,
            save_all=True,
            append_images=scaled[1:],
            duration=durations,
            loop=0,
            disposal=2
        )
        print("Saved GIF:", out_path)

    save_gif(eat_front_frames, "cat_eating_front.gif", [260, 180, 200, 220, 200, 220, 240, 400])
    save_gif(eat_side_left_frames, "cat_eating_side.gif", [260, 180, 200, 220, 200, 220, 240, 400])
    save_gif(drink_frames, "cat_drinking.gif", [260, 180, 200, 220, 200, 220, 240, 400])
    save_gif(pet_frames, "cat_petted.gif", [250, 200, 220, 250, 200, 250, 220, 350])

    # 5. UPDATE cat.png (Backup first)
    backup_path = os.path.join(sprites_dir, "cat.original.png")
    if not os.path.exists(backup_path):
        cat.save(backup_path)
        print("Backed up original cat.png to:", backup_path)

    # Paste row 20 (eat, 8 frames)
    for i in range(8):
        cat.paste(eat_front_frames[i], (i * 32, 20 * 32), eat_front_frames[i])

    # Paste row 43 (petted, 8 frames)
    for i in range(8):
        cat.paste(pet_frames[i], (i * 32, 43 * 32), pet_frames[i])

    cat.save(cat_path)
    print("Updated public/sprites/cat.png with new eating (row 20) and petted (row 43) animations!")

if __name__ == "__main__":
    generate_all()
